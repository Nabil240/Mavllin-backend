const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const ProductModel = require('../../backend/src/models/product.model');
const { pool, checkDbHealth } = require('../../backend/src/config/db');

describe('Empirical Challenger: Deep Concurrency, Oversell & Transaction Isolation Stress Test', () => {
  let isDbAvailable = false;

  before(async () => {
    try {
      const health = await checkDbHealth();
      isDbAvailable = Boolean(health && health.isConnected);
    } catch {
      isDbAvailable = false;
    }
  });

  it('Live MySQL Stress 1: 40 concurrent decrements against stock of 20 (exact oversell threshold)', async (t) => {
    if (!isDbAvailable) {
      if (t && typeof t.skip === 'function') t.skip('MySQL not reachable');
      return;
    }

    // Setup product & variant with 20 stock
    const conn = await pool.getConnection();
    let productId, variantId;
    try {
      const [pRes] = await conn.query(
        "INSERT INTO products (name, slug, base_price, is_active) VALUES ('Stress Test Prod 1', ?, 50.00, 1)",
        [`stress-conc-1-${Date.now()}`]
      );
      productId = pRes.insertId;

      const [vRes] = await conn.query(
        "INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active) VALUES (?, ?, 'M', 'Black', 50.00, 20, 1)",
        [productId, `STRESS-SKU-1-${Date.now()}`]
      );
      variantId = vRes.insertId;
    } finally {
      conn.release();
    }

    try {
      // Launch 40 simultaneous decrements of 1
      const promises = Array.from({ length: 40 }, () =>
        ProductModel.adjustVariantStock(variantId, -1, 'order_placed', 1, null)
      );

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      assert.strictEqual(fulfilled.length, 20, 'Exactly 20 requests must succeed');
      assert.strictEqual(rejected.length, 20, 'Exactly 20 requests must reject');

      for (const rej of rejected) {
        assert.ok(
          rej.reason.message.includes('Insufficient stock'),
          `Rejection reason must be insufficient stock: ${rej.reason.message}`
        );
      }

      // Verify stock in MySQL is exactly 0
      const [rows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantId]);
      assert.strictEqual(rows[0].stock_quantity, 0, 'Final stock in DB must be exactly 0 (no oversell, no lost update)');

      // Verify inventory movements count is exactly 20
      const [movements] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = ?',
        [variantId]
      );
      assert.strictEqual(movements[0].count, 20, 'Exactly 20 inventory movement rows must be recorded');
    } finally {
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [variantId]);
      await pool.query('DELETE FROM product_variants WHERE id = ?', [variantId]);
      await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    }
  });

  it('Live MySQL Stress 2: 20 concurrent multi-unit decrements (-3) against stock of 10', async (t) => {
    if (!isDbAvailable) {
      if (t && typeof t.skip === 'function') t.skip('MySQL not reachable');
      return;
    }

    const conn = await pool.getConnection();
    let productId, variantId;
    try {
      const [pRes] = await conn.query(
        "INSERT INTO products (name, slug, base_price, is_active) VALUES ('Stress Test Prod 2', ?, 30.00, 1)",
        [`stress-conc-2-${Date.now()}`]
      );
      productId = pRes.insertId;

      const [vRes] = await conn.query(
        "INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active) VALUES (?, ?, 'L', 'White', 30.00, 10, 1)",
        [productId, `STRESS-SKU-2-${Date.now()}`]
      );
      variantId = vRes.insertId;
    } finally {
      conn.release();
    }

    try {
      // 10 stock with decrements of 3 each: only 3 can succeed (leaving 1 stock), 17 must fail
      const promises = Array.from({ length: 20 }, () =>
        ProductModel.adjustVariantStock(variantId, -3, 'order_placed', 1, null)
      );

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      assert.strictEqual(fulfilled.length, 3, 'Exactly 3 orders of 3 units must succeed (9 units deducted)');
      assert.strictEqual(rejected.length, 17, 'Exactly 17 orders must reject due to insufficient stock');

      const [rows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantId]);
      assert.strictEqual(rows[0].stock_quantity, 1, 'Final stock in DB must be exactly 1');

      const [movements] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = ?',
        [variantId]
      );
      assert.strictEqual(movements[0].count, 3, 'Exactly 3 movements recorded');
    } finally {
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [variantId]);
      await pool.query('DELETE FROM product_variants WHERE id = ?', [variantId]);
      await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    }
  });

  it('Live MySQL Stress 3: Mixed concurrent decrements (-2) and increments (+5)', async (t) => {
    if (!isDbAvailable) {
      if (t && typeof t.skip === 'function') t.skip('MySQL not reachable');
      return;
    }

    const conn = await pool.getConnection();
    let productId, variantId;
    try {
      const [pRes] = await conn.query(
        "INSERT INTO products (name, slug, base_price, is_active) VALUES ('Stress Test Prod 3', ?, 25.00, 1)",
        [`stress-conc-3-${Date.now()}`]
      );
      productId = pRes.insertId;

      const [vRes] = await conn.query(
        "INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active) VALUES (?, ?, 'S', 'Navy', 25.00, 6, 1)",
        [productId, `STRESS-SKU-3-${Date.now()}`]
      );
      variantId = vRes.insertId;
    } finally {
      conn.release();
    }

    try {
      // Starting stock: 6.
      // Dispatch 8 decrements of -2 and 4 increments of +5 concurrently
      const tasks = [];
      for (let i = 0; i < 8; i++) {
        tasks.push(ProductModel.adjustVariantStock(variantId, -2, 'order_placed', 1, null));
      }
      for (let j = 0; j < 4; j++) {
        tasks.push(ProductModel.adjustVariantStock(variantId, 5, 'restock', 1, null));
      }

      // Shuffle tasks
      tasks.sort(() => Math.random() - 0.5);

      const outcomes = await Promise.allSettled(tasks);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');

      // Calculate expected final stock: initial (6) + sum of successful deltas
      let expectedFinalStock = 6;
      for (const f of fulfilled) {
        expectedFinalStock += f.value.delta;
      }

      const [rows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantId]);
      assert.strictEqual(
        rows[0].stock_quantity,
        expectedFinalStock,
        `Final stock (${rows[0].stock_quantity}) must match algebraic sum of successful deltas (${expectedFinalStock})`
      );
      assert.ok(rows[0].stock_quantity >= 0, 'Stock must never fall below zero');

      const [movements] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = ?',
        [variantId]
      );
      assert.strictEqual(movements[0].count, fulfilled.length, 'Movement count must match fulfilled count');
    } finally {
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [variantId]);
      await pool.query('DELETE FROM product_variants WHERE id = ?', [variantId]);
      await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    }
  });

  it('Live MySQL Stress 4: External transaction scoping in adjustVariantStock (caller rollback rollbacks stock & movement)', async (t) => {
    if (!isDbAvailable) {
      if (t && typeof t.skip === 'function') t.skip('MySQL not reachable');
      return;
    }

    const externalConn = await pool.getConnection();
    let productId, variantId;

    try {
      // Create test product and variant
      const [pRes] = await externalConn.query(
        "INSERT INTO products (name, slug, base_price, is_active) VALUES ('Rollback Scope Test', ?, 40.00, 1)",
        [`stress-scope-${Date.now()}`]
      );
      productId = pRes.insertId;

      const [vRes] = await externalConn.query(
        "INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active) VALUES (?, ?, 'XL', 'Grey', 40.00, 50, 1)",
        [productId, `STRESS-SKU-4-${Date.now()}`]
      );
      variantId = vRes.insertId;

      // Start an external transaction on externalConn
      await externalConn.beginTransaction();

      // Adjust stock using externalConn
      const result = await ProductModel.adjustVariantStock(
        variantId,
        -10,
        'order_placed',
        1,
        null,
        externalConn
      );

      assert.strictEqual(result.afterQty, 40);

      // Now ROLL BACK the external transaction!
      await externalConn.rollback();

      // Check stock with a different connection (or pool)
      const [rows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantId]);
      assert.strictEqual(
        rows[0].stock_quantity,
        50,
        'Stock must be 50 because the external transaction was rolled back (adjustVariantStock must not commit prematurely)'
      );

      // Check movements
      const [movements] = await pool.query(
        'SELECT COUNT(*) as count FROM inventory_movements WHERE variant_id = ?',
        [variantId]
      );
      assert.strictEqual(
        movements[0].count,
        0,
        'Movement must be rolled back with the transaction'
      );
    } finally {
      externalConn.release();
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [variantId]);
      await pool.query('DELETE FROM product_variants WHERE id = ?', [variantId]);
      await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    }
  });

  it('Live MySQL Stress 5: Connection pool stability under 50 rapid transaction failures in ProductModel.create', async (t) => {
    if (!isDbAvailable) {
      if (t && typeof t.skip === 'function') t.skip('MySQL not reachable');
      return;
    }

    // Fire 50 failing create calls rapidly (e.g. duplicate slug or invalid data)
    const promises = Array.from({ length: 50 }, (_, i) => {
      return ProductModel.create(
        { name: `Fail Prod ${i}`, slug: `fail-slug-${i}`, base_price: 10 },
        [
          { sku: `FAIL-SKU-${i}-1`, size: 'M', color: 'Red', price: 10 },
          { sku: `FAIL-SKU-${i}-2`, size: 'M', color: 'Red', price: 10 }, // Duplicate size & color!
        ]
      );
    });

    const results = await Promise.allSettled(promises);
    assert.strictEqual(results.filter((r) => r.status === 'rejected').length, 50, 'All 50 calls must reject');

    // Verify pool is still completely healthy and responsive
    const health = await checkDbHealth();
    assert.strictEqual(health.isConnected, true, 'Pool connection must remain healthy without exhaustion');

    // Run a query on pool to ensure connections are available
    const [testRow] = await pool.query('SELECT 1 as val');
    assert.strictEqual(testRow[0].val, 1, 'Pool must readily yield working connections');
  });
});
