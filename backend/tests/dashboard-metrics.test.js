const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const DashboardModel = require('../src/models/dashboard.model');
const ProductModel = require('../src/models/product.model');
const { getAdminToken } = require('./helpers/auth.helper');

describe('Milestone 8: Dashboard Investment Amount & Realized Profit Metrics', () => {
  let adminToken;
  const createdProductIds = [];
  const createdOrderIds = [];

  before(async () => {
    adminToken = getAdminToken();
  });

  after(async () => {
    // Clean up created orders & order items
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [createdOrderIds]);
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }

    // Clean up created test products & variants
    if (createdProductIds.length > 0) {
      await pool.query('DELETE FROM inventory_movements WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id IN (?))', [createdProductIds]);
      await pool.query('DELETE FROM product_variants WHERE product_id IN (?)', [createdProductIds]);
      await pool.query('DELETE FROM products WHERE id IN (?)', [createdProductIds]);
    }
  });

  describe('1. ProductModel Base Cost Persistence', () => {
    it('creates product with explicit base_cost and persists to database', async () => {
      const ts = Date.now();
      const product = await ProductModel.create({
        name: `Test Cost Polo ${ts}`,
        slug: `test-cost-polo-${ts}`,
        sku: `POLO-${ts}`,
        base_cost: 650.00,
        base_price: 1200.00,
        is_active: 1,
        variants: [
          { sku: `POLO-${ts}-M`, size: 'M', color: 'Navy', price: 1200.00, stock_quantity: 20, is_active: 1 }
        ]
      });

      assert.ok(product);
      assert.ok(product.id);
      createdProductIds.push(product.id);

      const [rows] = await pool.query('SELECT id, base_cost, base_price FROM products WHERE id = ?', [product.id]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(Number(rows[0].base_cost), 650.00);
      assert.strictEqual(Number(rows[0].base_price), 1200.00);
    });

    it('updates product base_cost and retrieves updated value', async () => {
      const ts = Date.now();
      const product = await ProductModel.create({
        name: `Test Cost Update ${ts}`,
        slug: `test-cost-update-${ts}`,
        sku: `COST-${ts}`,
        base_cost: 500.00,
        base_price: 900.00,
        is_active: 1,
        variants: [
          { sku: `COST-${ts}-S`, size: 'S', color: 'Black', price: 900.00, stock_quantity: 15, is_active: 1 }
        ]
      });
      createdProductIds.push(product.id);

      await ProductModel.update(product.id, { base_cost: 550.00 });

      const [rows] = await pool.query('SELECT base_cost FROM products WHERE id = ?', [product.id]);
      assert.strictEqual(Number(rows[0].base_cost), 550.00);
    });
  });

  describe('2. Total Investment Amount Calculation Logic', () => {
    it('calculates investment based on base_cost * stock_quantity for active variants', async () => {
      const ts = Date.now();
      // Product A: base_cost 400, stock 10 -> 4000
      const prodA = await ProductModel.create({
        name: `Invest Product A ${ts}`,
        slug: `invest-a-${ts}`,
        sku: `INV-A-${ts}`,
        base_cost: 400.00,
        base_price: 800.00,
        is_active: 1,
        variants: [
          { sku: `INV-A1-${ts}`, size: 'M', color: 'White', price: 800.00, stock_quantity: 10, is_active: 1 }
        ]
      });
      createdProductIds.push(prodA.id);

      const [res] = await pool.query(`
        SELECT COALESCE(SUM(
          COALESCE(p.base_cost, p.base_price, pv.price, 0) * GREATEST(0, pv.stock_quantity)
        ), 0) AS inv
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE p.id = ?
      `, [prodA.id]);

      assert.strictEqual(Number(res[0].inv), 4000.00);
    });

    it('falls back to base_price when base_cost is NULL', async () => {
      const ts = Date.now();
      // Product B: base_cost NULL, base_price 750, stock 8 -> 6000
      const prodB = await ProductModel.create({
        name: `Invest Product B ${ts}`,
        slug: `invest-b-${ts}`,
        sku: `INV-B-${ts}`,
        base_price: 750.00,
        is_active: 1,
        variants: [
          { sku: `INV-B1-${ts}`, size: 'L', color: 'Olive', price: 750.00, stock_quantity: 8, is_active: 1 }
        ]
      });
      createdProductIds.push(prodB.id);

      const [res] = await pool.query(`
        SELECT COALESCE(SUM(
          COALESCE(p.base_cost, p.base_price, pv.price, 0) * GREATEST(0, pv.stock_quantity)
        ), 0) AS inv
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE p.id = ?
      `, [prodB.id]);

      assert.strictEqual(Number(res[0].inv), 6000.00);
    });

    it('clamps zero or negative stock to zero preventing negative investment contribution', async () => {
      const ts = Date.now();
      const prodZero = await ProductModel.create({
        name: `Invest Product Zero ${ts}`,
        slug: `invest-zero-${ts}`,
        sku: `INV-ZERO-${ts}`,
        base_cost: 500.00,
        base_price: 1000.00,
        is_active: 1,
        variants: [
          { sku: `INV-ZERO1-${ts}`, size: 'S', color: 'Grey', price: 1000.00, stock_quantity: 0, is_active: 1 }
        ]
      });
      createdProductIds.push(prodZero.id);

      // Verify stock_quantity = 0 evaluates to 0
      const [resZero] = await pool.query(`
        SELECT COALESCE(SUM(
          COALESCE(p.base_cost, p.base_price, pv.price, 0) * GREATEST(0, pv.stock_quantity)
        ), 0) AS inv
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE p.id = ?
      `, [prodZero.id]);
      assert.strictEqual(Number(resZero[0].inv), 0);

      // Verify GREATEST(0, -5) mathematical clamp
      const [resClamp] = await pool.query(`
        SELECT GREATEST(0, -5) AS clamped, GREATEST(0, 10) AS positive
      `);
      assert.strictEqual(Number(resClamp[0].clamped), 0);
      assert.strictEqual(Number(resClamp[0].positive), 10);
    });

    it('excludes inactive products and inactive variants from total_investment', async () => {
      const ts = Date.now();
      const prodInactive = await ProductModel.create({
        name: `Invest Product Inactive ${ts}`,
        slug: `invest-inactive-${ts}`,
        sku: `INV-INACT-${ts}`,
        base_cost: 300.00,
        base_price: 600.00,
        is_active: 0,
        variants: [
          { sku: `INV-INACT1-${ts}`, size: 'M', color: 'Red', price: 600.00, stock_quantity: 50, is_active: 0 }
        ]
      });
      createdProductIds.push(prodInactive.id);

      const [res] = await pool.query(`
        SELECT COALESCE(SUM(
          COALESCE(p.base_cost, p.base_price, pv.price, 0) * GREATEST(0, pv.stock_quantity)
        ), 0) AS inv
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE p.id = ? AND pv.is_active = 1 AND p.is_active = 1
      `, [prodInactive.id]);

      assert.strictEqual(Number(res[0].inv), 0);
    });
  });

  describe('3. Realized Sales Profit Calculation Logic', () => {
    it('calculates realized profit as revenue minus COGS for completed (paid & non-cancelled) orders', async () => {
      const ts = Date.now();
      // Setup test product: cost 300, price 500
      const prod = await ProductModel.create({
        name: `Profit Product ${ts}`,
        slug: `profit-product-${ts}`,
        sku: `PRF-${ts}`,
        base_cost: 300.00,
        base_price: 500.00,
        is_active: 1,
        variants: [
          { sku: `PRF-M-${ts}`, size: 'M', color: 'Teal', price: 500.00, stock_quantity: 10, is_active: 1 }
        ]
      });
      createdProductIds.push(prod.id);
      const variantId = prod.variants[0].id;

      // Create a paid order: 2 units = revenue 1000, COGS = 2 * 300 = 600, Profit = 400
      const [orderRes] = await pool.query(`
        INSERT INTO orders (
          order_number, total_amount, subtotal, status, payment_status, payment_method, shipping_address
        ) VALUES (?, 1000.00, 1000.00, 'delivered', 'paid', 'cod', JSON_OBJECT('recipient_name', 'Profit Tester'))
      `, [`ORD-PRF-${ts}`]);
      const orderId = orderRes.insertId;
      createdOrderIds.push(orderId);

      await pool.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, variant_sku, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, 500.00, 2, 1000.00)
      `, [orderId, prod.id, variantId, prod.name, `PRF-M-${ts}`]);

      // Calculate realized profit for this specific order
      const [profitRes] = await pool.query(`
        SELECT COALESCE(
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE id = ? AND status != 'cancelled' AND payment_status = 'paid')
          -
          (SELECT COALESCE(SUM(oi.quantity * COALESCE(p.base_cost, p.base_price, oi.unit_price, 0)), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE o.id = ? AND o.status != 'cancelled' AND o.payment_status = 'paid'),
          0
        ) AS profit
      `, [orderId, orderId]);

      assert.strictEqual(Number(profitRes[0].profit), 400.00);
    });

    it('excludes unpaid orders from realized profit calculation', async () => {
      const ts = Date.now();
      const prod = await ProductModel.create({
        name: `Unpaid Product ${ts}`,
        slug: `unpaid-product-${ts}`,
        sku: `UNP-${ts}`,
        base_cost: 200.00,
        base_price: 400.00,
        is_active: 1,
        variants: [
          { sku: `UNP-M-${ts}`, size: 'M', color: 'White', price: 400.00, stock_quantity: 10, is_active: 1 }
        ]
      });
      createdProductIds.push(prod.id);
      const variantId = prod.variants[0].id;

      // Pending unpaid order
      const [orderRes] = await pool.query(`
        INSERT INTO orders (
          order_number, total_amount, subtotal, status, payment_status, payment_method, shipping_address
        ) VALUES (?, 400.00, 400.00, 'pending', 'unpaid', 'cash_on_delivery', JSON_OBJECT('recipient_name', 'Unpaid Tester'))
      `, [`ORD-UNP-${ts}`]);
      const orderId = orderRes.insertId;
      createdOrderIds.push(orderId);

      await pool.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, variant_sku, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, 400.00, 1, 400.00)
      `, [orderId, prod.id, variantId, prod.name, `UNP-M-${ts}`]);

      const [profitRes] = await pool.query(`
        SELECT COALESCE(
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE id = ? AND status != 'cancelled' AND payment_status = 'paid')
          -
          (SELECT COALESCE(SUM(oi.quantity * COALESCE(p.base_cost, p.base_price, oi.unit_price, 0)), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE o.id = ? AND o.status != 'cancelled' AND o.payment_status = 'paid'),
          0
        ) AS profit
      `, [orderId, orderId]);

      assert.strictEqual(Number(profitRes[0].profit), 0);
    });

    it('excludes cancelled orders even if previously marked paid', async () => {
      const ts = Date.now();
      const prod = await ProductModel.create({
        name: `Cancelled Product ${ts}`,
        slug: `cancelled-product-${ts}`,
        sku: `CAN-${ts}`,
        base_cost: 150.00,
        base_price: 300.00,
        is_active: 1,
        variants: [
          { sku: `CAN-M-${ts}`, size: 'M', color: 'White', price: 300.00, stock_quantity: 10, is_active: 1 }
        ]
      });
      createdProductIds.push(prod.id);
      const variantId = prod.variants[0].id;

      // Cancelled order with payment_status = 'paid' (e.g. refunded or cancelled post-payment)
      const [orderRes] = await pool.query(`
        INSERT INTO orders (
          order_number, total_amount, subtotal, status, payment_status, payment_method, shipping_address
        ) VALUES (?, 600.00, 600.00, 'cancelled', 'paid', 'manual', JSON_OBJECT('recipient_name', 'Cancelled Tester'))
      `, [`ORD-CAN-${ts}`]);
      const orderId = orderRes.insertId;
      createdOrderIds.push(orderId);

      await pool.query(`
        INSERT INTO order_items (
          order_id, product_id, variant_id, product_name, variant_sku, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, 300.00, 2, 600.00)
      `, [orderId, prod.id, variantId, prod.name, `CAN-M-${ts}`]);

      const [profitRes] = await pool.query(`
        SELECT COALESCE(
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE id = ? AND status != 'cancelled' AND payment_status = 'paid')
          -
          (SELECT COALESCE(SUM(oi.quantity * COALESCE(p.base_cost, p.base_price, oi.unit_price, 0)), 0)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE o.id = ? AND o.status != 'cancelled' AND o.payment_status = 'paid'),
          0
        ) AS profit
      `, [orderId, orderId]);

      assert.strictEqual(Number(profitRes[0].profit), 0);
    });
  });

  describe('4. Dashboard API Integration (GET /api/v1/admin/dashboard)', () => {
    it('returns total_investment and realized_profit with compatibility aliases', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const stats = res.body.data.stats;
      assert.ok(stats, 'stats object must be present');

      // Assert fields exist and are numeric
      assert.strictEqual(typeof stats.total_investment, 'number');
      assert.strictEqual(typeof stats.realized_profit, 'number');
      assert.strictEqual(typeof stats.investment_amount, 'number');
      assert.strictEqual(typeof stats.profit, 'number');

      // Assert aliases match primary fields
      assert.strictEqual(stats.total_investment, stats.investment_amount);
      assert.strictEqual(stats.realized_profit, stats.profit);

      // Assert non-negative investment
      assert.ok(stats.total_investment >= 0, 'Total investment must be >= 0');

      // Confirm overview stats model output includes the calculated values
      const modelStats = await DashboardModel.getOverviewStats();
      assert.ok(modelStats.total_investment !== undefined);
      assert.ok(modelStats.realized_profit !== undefined);
    });

    it('rejects unauthenticated requests to /api/v1/admin/dashboard with 401', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      assert.strictEqual(res.statusCode, 401);
    });
  });
});
