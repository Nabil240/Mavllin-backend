const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ProductModel = require('../../backend/src/models/product.model');

describe('Adversarial Challenge: Concurrent Stock Adjustments & Race Conditions', () => {
  it('Challenge 1: Insufficient stock boundary rejection', async () => {
    // Mock database connection simulating a variant with stock = 10
    const queries = [];
    const mockDb = {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
          return [[{ id: 101, stock_quantity: 10 }]];
        }
        return [{ affectedRows: 1 }];
      },
    };

    // Attempt to decrement 15 when only 10 are available
    await assert.rejects(
      async () => {
        await ProductModel.adjustVariantStock(101, -15, 'order_placed', 1, 999, mockDb);
      },
      (err) => {
        assert.ok(err.message.includes('Insufficient stock for variant 101'));
        assert.ok(err.message.includes('Available: 10, Requested delta: -15'));
        return true;
      }
    );

    // Verify that NO update or inventory movement was executed after rejection
    const updateExecuted = queries.some((q) => q.sql.includes('UPDATE product_variants'));
    const movementExecuted = queries.some((q) => q.sql.includes('INSERT INTO inventory_movements'));
    assert.strictEqual(updateExecuted, false, 'UPDATE must not execute on insufficient stock');
    assert.strictEqual(movementExecuted, false, 'Inventory movement must not be recorded on rejection');
  });

  it('Challenge 2: Non-existent variant rejection', async () => {
    const mockDb = {
      async query(sql) {
        if (sql.includes('SELECT id, stock_quantity FROM product_variants')) {
          return [[]]; // Not found
        }
        return [{ affectedRows: 0 }];
      },
    };

    await assert.rejects(
      async () => {
        await ProductModel.adjustVariantStock(99999, -1, 'order_placed', null, null, mockDb);
      },
      (err) => {
        assert.ok(err.message.includes('Product variant 99999 not found'));
        return true;
      }
    );
  });

  it('Challenge 3: Serialized concurrent decrements prevent lost updates', async () => {
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
            return [[{ id: 42, stock_quantity: readVal }]];
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
        async commit() {},
        async rollback() {
          if (holdsLock) {
            activeLock = false;
            holdsLock = false;
          }
        },
        release() {},
      };
    };

    // Run 2 concurrent stock decrements (-1 each) starting from stock = 10
    const conn1 = createLockingConnection('REQ_1');
    const conn2 = createLockingConnection('REQ_2');

    const [res1, res2] = await Promise.all([
      ProductModel.adjustVariantStock(42, -1, 'order_placed', 1, 101, conn1),
      ProductModel.adjustVariantStock(42, -1, 'order_placed', 2, 102, conn2),
    ]);

    assert.strictEqual(res1.delta, -1);
    assert.strictEqual(res2.delta, -1);

    const afterQtys = [res1.afterQty, res2.afterQty].sort((a, b) => a - b);
    assert.deepStrictEqual(afterQtys, [8, 9], 'One request finishes at 9, the second at 8');
    assert.strictEqual(currentStock, 8, 'Final stock in DB must be exactly 8 (no lost update)');
  });

  it('Challenge 4: Concurrent oversell attempts safely reject excess demand', async () => {
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
        async commit() {},
        async rollback() {
          if (holdsLock) {
            activeLock = false;
            holdsLock = false;
          }
        },
        release() {},
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
    assert.strictEqual(currentStock, 1, 'Remaining stock must be 1 (no overselling)');
  });
});
