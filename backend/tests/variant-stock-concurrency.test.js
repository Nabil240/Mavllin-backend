const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const ProductModel = require('../src/models/product.model');
const { pool, checkDbHealth } = require('../src/config/db');

describe('Product Variant Stock Concurrency & Transaction Integrity', () => {
  let isDbAvailable = false;

  before(async () => {
    try {
      const health = await checkDbHealth();
      isDbAvailable = Boolean(health && health.isConnected);
    } catch {
      isDbAvailable = false;
    }
  });

  describe('1. Transaction Lifecycle & Scoping (when connection is null)', () => {
    it('Executes queries within transaction and commits safely on success', async () => {
      let transactionStarted = false;
      let transactionCommitted = false;
      let connectionReleased = false;
      const queries = [];

      const mockConn = {
        async beginTransaction() {
          transactionStarted = true;
        },
        async query(sql, params) {
          queries.push({ sql, params });
          if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
            return [[{ id: 777, stock_quantity: 15 }]];
          }
          if (sql.includes('UPDATE product_variants')) {
            return [{ affectedRows: 1 }];
          }
          if (sql.includes('INSERT INTO inventory_movements')) {
            return [{ insertId: 101 }];
          }
          return [[]];
        },
        async commit() {
          transactionCommitted = true;
        },
        async rollback() {},
        release() {
          connectionReleased = true;
        },
      };

      const origGetConnection = pool.getConnection;
      pool.getConnection = async () => mockConn;

      try {
        const res = await ProductModel.adjustVariantStock(
          777,
          -5,
          'order_placed',
          1,
          1001,
          null
        );

        assert.strictEqual(res.variantId, 777);
        assert.strictEqual(res.beforeQty, 15);
        assert.strictEqual(res.afterQty, 10);
        assert.strictEqual(res.delta, -5);

        assert.strictEqual(transactionStarted, true, 'beginTransaction must be called');
        assert.strictEqual(transactionCommitted, true, 'commit must be called');
        assert.strictEqual(connectionReleased, true, 'release must be called in finally');

        const hasSelectForUpdate = queries.some((q) => q.sql.includes('FOR UPDATE'));
        const hasUpdate = queries.some((q) => q.sql.includes('UPDATE product_variants'));
        const hasMovement = queries.some((q) => q.sql.includes('INSERT INTO inventory_movements'));

        assert.strictEqual(hasSelectForUpdate, true, 'Must execute SELECT ... FOR UPDATE');
        assert.strictEqual(hasUpdate, true, 'Must execute UPDATE on variant stock');
        assert.strictEqual(hasMovement, true, 'Must insert inventory movement audit log');
      } finally {
        pool.getConnection = origGetConnection;
      }
    });

    it('Rolls back transaction and prevents movements when stock is insufficient', async () => {
      let rolledBack = false;
      let released = false;
      const queries = [];

      const mockConn = {
        async beginTransaction() {},
        async query(sql, params) {
          queries.push({ sql, params });
          if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
            return [[{ id: 777, stock_quantity: 2 }]]; // Only 2 in stock
          }
          return [{ affectedRows: 1 }];
        },
        async commit() {},
        async rollback() {
          rolledBack = true;
        },
        release() {
          released = true;
        },
      };

      const origGetConnection = pool.getConnection;
      pool.getConnection = async () => mockConn;

      try {
        // Attempt to deduct 5 units from stock of 2
        await assert.rejects(
          async () => {
            await ProductModel.adjustVariantStock(777, -5, 'order_placed', 1, 1002, null);
          },
          (err) => {
            assert.ok(err.message.includes('Insufficient stock'));
            return true;
          }
        );

        assert.strictEqual(rolledBack, true, 'Transaction must be rolled back on insufficient stock');
        assert.strictEqual(released, true, 'Connection must be released in finally');

        // Verify that no UPDATE or movement INSERT was executed
        const hasUpdate = queries.some((q) => q.sql.includes('UPDATE product_variants'));
        const hasMovement = queries.some((q) => q.sql.includes('INSERT INTO inventory_movements'));
        assert.strictEqual(hasUpdate, false, 'UPDATE must not execute on insufficient stock');
        assert.strictEqual(hasMovement, false, 'INSERT INTO inventory_movements must not execute on insufficient stock');
      } finally {
        pool.getConnection = origGetConnection;
      }
    });
  });

  describe('2. Concurrency Simulation & Race Condition Prevention', () => {
    it('Serialized concurrent decrements prevent lost updates', async () => {
      let currentStock = 10;
      let activeLock = false;
      const executionTrace = [];

      const createLockingConnection = (actorId) => {
        let holdsLock = false;
        return {
          async beginTransaction() {},
          async query(sql, params) {
            if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
              while (activeLock) {
                await new Promise((r) => setTimeout(r, 5));
              }
              activeLock = true;
              holdsLock = true;
              const readVal = currentStock;
              executionTrace.push({ actor: actorId, action: 'LOCKED_READ', stock: readVal });
              await new Promise((r) => setTimeout(r, 10));
              return [[{ id: 88, stock_quantity: readVal }]];
            }
            if (sql.includes('UPDATE product_variants')) {
              currentStock = currentStock + params[0];
              executionTrace.push({ actor: actorId, action: 'WRITE', stock: currentStock });
              return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO inventory_movements')) {
              if (holdsLock) {
                activeLock = false;
                holdsLock = false;
                executionTrace.push({ actor: actorId, action: 'COMMIT_RELEASE' });
              }
              return [{ insertId: 1 }];
            }
            return [[]];
          },
          async commit() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
          async rollback() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
          release() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
        };
      };

      // Launch 2 concurrent decrements of 1
      const conn1 = createLockingConnection('REQ_1');
      const conn2 = createLockingConnection('REQ_2');

      const [res1, res2] = await Promise.all([
        ProductModel.adjustVariantStock(88, -1, 'order_placed', 1, 101, conn1),
        ProductModel.adjustVariantStock(88, -1, 'order_placed', 2, 102, conn2),
      ]);

      assert.strictEqual(res1.delta, -1);
      assert.strictEqual(res2.delta, -1);

      const afterQtys = [res1.afterQty, res2.afterQty].sort((a, b) => a - b);
      assert.deepStrictEqual(afterQtys, [8, 9], 'One request should finish at 9, and the second at 8');
      assert.strictEqual(currentStock, 8, 'Final stock in DB must be exactly 8 (no lost update)');
    });

    it('Concurrent oversell attempts safely reject excess demand', async () => {
      let currentStock = 5;
      let activeLock = false;

      const createLockingConnection = (actorId) => {
        let holdsLock = false;
        return {
          async beginTransaction() {},
          async query(sql, params) {
            if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
              while (activeLock) {
                await new Promise((r) => setTimeout(r, 5));
              }
              activeLock = true;
              holdsLock = true;
              await new Promise((r) => setTimeout(r, 10));
              return [[{ id: 99, stock_quantity: currentStock }]];
            }
            if (sql.includes('UPDATE product_variants')) {
              currentStock = currentStock + params[0];
              return [{ affectedRows: 1 }];
            }
            if (sql.includes('INSERT INTO inventory_movements')) {
              if (holdsLock) {
                activeLock = false;
                holdsLock = false;
              }
              return [{ insertId: 1 }];
            }
            return [[]];
          },
          async commit() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
          async rollback() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
          release() {
            if (holdsLock) {
              activeLock = false;
              holdsLock = false;
            }
          },
        };
      };

      const conn1 = createLockingConnection('ORD_1');
      const conn2 = createLockingConnection('ORD_2');

      const results = await Promise.allSettled([
        ProductModel.adjustVariantStock(99, -4, 'order_placed', 1, 1, conn1),
        ProductModel.adjustVariantStock(99, -4, 'order_placed', 2, 2, conn2),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one order of 4 must succeed');
      assert.strictEqual(rejected.length, 1, 'The second order of 4 must reject due to insufficient stock');
      assert.ok(rejected[0].reason.message.includes('Insufficient stock'));

      // Final stock must be 1, never negative
      assert.strictEqual(currentStock, 1, 'Remaining stock must be 1 (no overselling)');
    });
  });

  describe('3. Live MySQL Database Concurrency Endurance (conditional on DB availability)', () => {
    it('10 parallel decrements on live database execute with zero lost updates', async (t) => {
      if (!isDbAvailable) {
        if (t && typeof t.skip === 'function') {
          t.skip('Skipping live MySQL test: database container is not reachable in this environment.');
        }
        return;
      }

      // 1. Create a transient product with a variant holding 20 stock
      const connection = await pool.getConnection();
      let testVariantId;
      let testProductId;

      try {
        const [prodResult] = await connection.query(
          "INSERT INTO products (name, slug, base_price, is_active) VALUES ('Live Concurrency Test Prod', ?, 29.99, 1)",
          [`live-concurrent-${Date.now()}`]
        );
        testProductId = prodResult.insertId;

        const [varResult] = await connection.query(
          "INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active) VALUES (?, ?, 'M', 'Black', 29.99, 20, 1)",
          [testProductId, `CONC-SKU-${Date.now()}`]
        );
        testVariantId = varResult.insertId;
      } finally {
        connection.release();
      }

      assert.ok(testVariantId);

      // 2. Dispatch 10 concurrent decrements of 1 without external connection
      const tasks = Array.from({ length: 10 }, (_, i) =>
        ProductModel.adjustVariantStock(testVariantId, -1, 'manual_adjustment', null, null)
      );

      const results = await Promise.all(tasks);
      assert.strictEqual(results.length, 10);

      // 3. Verify final stock is exactly 10 (20 - 10)
      const [rows] = await pool.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ?',
        [testVariantId]
      );
      assert.strictEqual(rows[0].stock_quantity, 10, 'Live MySQL stock must be exactly 10 after 10 concurrent decrements');

      // 4. Verify 10 audit movement records were recorded
      const [movements] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = ?',
        [testVariantId]
      );
      assert.strictEqual(movements[0].count, 10, 'Must record exactly 10 inventory movements');

      // Clean up transient data
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [testVariantId]);
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]);
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    });
  });
});
