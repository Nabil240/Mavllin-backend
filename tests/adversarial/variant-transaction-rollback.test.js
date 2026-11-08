const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ProductModel = require('../../backend/src/models/product.model');
const { pool } = require('../../backend/src/config/db');

describe('Adversarial Challenge: Variant Creation Midway Failure & Transaction Rollback', () => {
  it('Challenge 1: Midway failure on 2nd variant triggers connection.rollback() and suppresses commit()', async () => {
    const lifecycleEvents = [];

    const mockConnection = {
      async beginTransaction() {
        lifecycleEvents.push('BEGIN_TRANSACTION');
      },
      async commit() {
        lifecycleEvents.push('COMMIT');
      },
      async rollback() {
        lifecycleEvents.push('ROLLBACK');
      },
      release() {
        lifecycleEvents.push('RELEASE');
      },
      async query(sql, params) {
        if (sql.includes('INSERT INTO products')) {
          lifecycleEvents.push('INSERT_PRODUCT');
          return [{ insertId: 777 }];
        }
        if (sql.includes('INSERT INTO product_variants')) {
          const sku = params[1];
          lifecycleEvents.push(`INSERT_VARIANT_${sku}`);
          // Succeed on variant 1, fail on variant 2
          if (sku === 'VAR-FAIL-MIDWAY') {
            const err = new Error('Duplicate entry for key product_variants.sku');
            err.code = 'ER_DUP_ENTRY';
            throw err;
          }
          return [{ insertId: 1001 }];
        }
        if (sql.includes('INSERT INTO inventory_movements')) {
          lifecycleEvents.push('INSERT_MOVEMENT');
          return [{ insertId: 5001 }];
        }
        return [[]];
      },
    };

    // Temporarily replace pool.getConnection
    const originalGetConnection = pool.getConnection;
    pool.getConnection = async () => mockConnection;

    try {
      const payload = {
        name: 'Eco Bomber Jacket',
        slug: 'eco-bomber-jacket',
        base_price: 89.99,
      };

      const variants = [
        { sku: 'VAR-SUCCESS-1', size: 'M', color: 'Black', price: 89.99, stock_quantity: 10 },
        { sku: 'VAR-FAIL-MIDWAY', size: 'L', color: 'Black', price: 89.99, stock_quantity: 10 },
      ];

      await assert.rejects(
        async () => {
          await ProductModel.create(payload, variants);
        },
        (err) => {
          assert.strictEqual(err.code, 'ER_DUP_ENTRY');
          return true;
        }
      );

      // Verify strict transaction lifecycle order:
      // 1. BEGIN_TRANSACTION
      // 2. INSERT_PRODUCT
      // 3. INSERT_VARIANT_VAR-SUCCESS-1
      // 4. INSERT_MOVEMENT
      // 5. INSERT_VARIANT_VAR-FAIL-MIDWAY (throws)
      // 6. ROLLBACK
      // 7. RELEASE
      assert.ok(lifecycleEvents.includes('BEGIN_TRANSACTION'), 'Must call beginTransaction()');
      assert.ok(lifecycleEvents.includes('INSERT_PRODUCT'), 'Must insert parent product first');
      assert.ok(lifecycleEvents.includes('INSERT_VARIANT_VAR-SUCCESS-1'), 'First variant succeeded');
      assert.ok(lifecycleEvents.includes('INSERT_VARIANT_VAR-FAIL-MIDWAY'), 'Second variant attempted');
      assert.ok(lifecycleEvents.includes('ROLLBACK'), 'Must call rollback() on error');
      assert.ok(lifecycleEvents.includes('RELEASE'), 'Must call release() in finally');
      assert.strictEqual(lifecycleEvents.includes('COMMIT'), false, 'Must NEVER call commit() after failure');

      // Verify exact relative order: ROLLBACK before RELEASE
      const rollbackIndex = lifecycleEvents.indexOf('ROLLBACK');
      const releaseIndex = lifecycleEvents.indexOf('RELEASE');
      assert.ok(rollbackIndex < releaseIndex, 'Rollback must precede connection release');
    } finally {
      pool.getConnection = originalGetConnection;
    }
  });

  it('Challenge 2: Midway failure on inventory movement audit log triggers rollback()', async () => {
    const lifecycleEvents = [];

    const mockConnection = {
      async beginTransaction() {
        lifecycleEvents.push('BEGIN');
      },
      async commit() {
        lifecycleEvents.push('COMMIT');
      },
      async rollback() {
        lifecycleEvents.push('ROLLBACK');
      },
      release() {
        lifecycleEvents.push('RELEASE');
      },
      async query(sql) {
        if (sql.includes('INSERT INTO products')) {
          return [{ insertId: 888 }];
        }
        if (sql.includes('INSERT INTO product_variants')) {
          return [{ insertId: 2001 }];
        }
        if (sql.includes('INSERT INTO inventory_movements')) {
          throw new Error('Disk full: cannot append to inventory_movements');
        }
        return [[]];
      },
    };

    const originalGetConnection = pool.getConnection;
    pool.getConnection = async () => mockConnection;

    try {
      const payload = { name: 'Audit Test Product', slug: 'audit-test-product', base_price: 25.0 };
      const variants = [{ sku: 'AUDIT-SKU-1', size: 'S', color: 'White', price: 25.0, stock_quantity: 5 }];

      await assert.rejects(
        async () => {
          await ProductModel.create(payload, variants);
        },
        (err) => {
          assert.ok(err.message.includes('Disk full'));
          return true;
        }
      );

      assert.ok(lifecycleEvents.includes('ROLLBACK'), 'Must rollback when inventory movement insert fails');
      assert.strictEqual(lifecycleEvents.includes('COMMIT'), false, 'Must not commit partial transaction');
      assert.ok(lifecycleEvents.includes('RELEASE'), 'Must release connection');
    } finally {
      pool.getConnection = originalGetConnection;
    }
  });

  it('Challenge 3: Expose Connection Pool Leak Bug when beginTransaction() throws', async () => {
    // In ProductModel.create (lines 324-325):
    //   const connection = await pool.getConnection();
    //   await connection.beginTransaction();
    //   try { ... } finally { connection.release(); }
    //
    // Notice that `beginTransaction()` is outside the try-finally block!
    // If beginTransaction() throws an error (e.g. pool timeout or handshake failure),
    // connection.release() is NEVER called, leaking the acquired connection!
    let released = false;

    const mockConnection = {
      async beginTransaction() {
        throw new Error('Connection lost before transaction started');
      },
      release() {
        released = true;
      },
    };

    const originalGetConnection = pool.getConnection;
    pool.getConnection = async () => mockConnection;

    try {
      await assert.rejects(async () => {
        await ProductModel.create({ name: 'Leak Test' }, []);
      });

      // Assert that connection is properly released even if beginTransaction fails
      assert.strictEqual(
        released,
        true,
        'Connection is guaranteed to be released back to the pool even when beginTransaction() rejects'
      );
    } finally {
      pool.getConnection = originalGetConnection;
    }
  });

  it('Challenge 4: High-volume variant batch rollback (50 variants)', async () => {
    // Product with 50 variants, where variant #50 fails
    let variantsInsertedCount = 0;
    let rolledBack = false;

    const mockConnection = {
      async beginTransaction() {},
      async commit() {
        throw new Error('Should not commit');
      },
      async rollback() {
        rolledBack = true;
      },
      release() {},
      async query(sql, params) {
        if (sql.includes('INSERT INTO products')) return [{ insertId: 999 }];
        if (sql.includes('INSERT INTO product_variants')) {
          const sku = params[1];
          if (sku === 'BATCH-VAR-49') {
            throw new Error('Variant 49 constraint failure');
          }
          variantsInsertedCount++;
          return [{ insertId: variantsInsertedCount }];
        }
        if (sql.includes('INSERT INTO inventory_movements')) return [{ insertId: 1 }];
        return [[]];
      },
    };

    const originalGetConnection = pool.getConnection;
    pool.getConnection = async () => mockConnection;

    try {
      const variants = Array.from({ length: 50 }, (_, i) => ({
        sku: `BATCH-VAR-${i}`,
        size: `Size-${i}`,
        color: 'Blue',
        price: 20.0 + i,
        stock_quantity: 5,
      }));

      await assert.rejects(async () => {
        await ProductModel.create({ name: 'Batch 50 Product' }, variants);
      });

      assert.strictEqual(variantsInsertedCount, 49, '49 variants were inserted before failure');
      assert.strictEqual(rolledBack, true, 'Transaction rolled back all 49 variants and parent product');
    } finally {
      pool.getConnection = originalGetConnection;
    }
  });
});
