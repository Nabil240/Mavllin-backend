const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('../../backend/node_modules/mysql2/promise');
const env = require('../../backend/src/config/env');
const { pool } = require('../../backend/src/config/db');
const { ApiClient } = require('../e2e/helpers/api-client');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const client = new ApiClient(BASE_URL);

describe('Empirical Adversarial Challenge: Customer Purchase Journey & COD Checkout Stress', () => {
  let dbConn;
  let inProcessServer = null;

  const timestamp = Date.now();
  const testCustomerEmail = `stress_cust_${timestamp}@projecteco.test`;
  const testCustomerPassword = 'Customer@123';
  let testCustomerId;
  let testCustomerToken;

  // Track created orders and variants for cleanup
  const createdOrderIds = [];
  const createdVariantIds = [];
  const createdUserIds = [];

  before(async () => {
    // 1. Establish direct MySQL connection
    dbConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });

    // 2. Check if API server is already listening
    let serverResponding = false;
    try {
      const probe = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
      if (probe.ok) serverResponding = true;
    } catch (_e) {
      serverResponding = false;
    }

    if (!serverResponding) {
      const app = require('../../backend/src/app');
      const url = new URL(BASE_URL);
      const port = Number(url.port) || 5000;
      await new Promise((resolve, reject) => {
        inProcessServer = app.listen(port, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    // 3. Register and login test customer
    const regRes = await client.post('/api/v1/auth/register', {
      full_name: 'Adversarial Challenger User',
      email: testCustomerEmail,
      password: testCustomerPassword,
      phone: '+8801999887766',
    });
    assert.equal(regRes.status, 201, `Failed to register test customer: ${JSON.stringify(regRes.body)}`);
    testCustomerId = regRes.body.data.user.id;
    createdUserIds.push(testCustomerId);

    const loginRes = await client.post('/api/v1/auth/login', {
      email: testCustomerEmail,
      password: testCustomerPassword,
    });
    assert.equal(loginRes.status, 200, 'Failed to login test customer');
    testCustomerToken = loginRes.body.data.token;
  });

  after(async () => {
    // Cleanup created orders and audit records
    if (createdOrderIds.length > 0) {
      try {
        await dbConn.query('DELETE FROM payments WHERE order_id IN (?)', [createdOrderIds]);
        await dbConn.query('DELETE FROM order_status_history WHERE order_id IN (?)', [createdOrderIds]);
        await dbConn.query('DELETE FROM order_items WHERE order_id IN (?)', [createdOrderIds]);
        await dbConn.query('DELETE FROM inventory_movements WHERE reference_order_id IN (?)', [createdOrderIds]);
        await dbConn.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
      } catch (err) {
        console.error('Error cleaning up orders in stress harness:', err.message);
      }
    }

    // Cleanup created test variants
    if (createdVariantIds.length > 0) {
      try {
        await dbConn.query('DELETE FROM inventory_movements WHERE variant_id IN (?)', [createdVariantIds]);
        await dbConn.query('DELETE FROM cart_items WHERE variant_id IN (?)', [createdVariantIds]);
        await dbConn.query('DELETE FROM product_variants WHERE id IN (?)', [createdVariantIds]);
      } catch (err) {
        console.error('Error cleaning up test variants:', err.message);
      }
    }

    // Cleanup created users
    if (createdUserIds.length > 0) {
      try {
        await dbConn.query('DELETE FROM cart_items WHERE user_id IN (?)', [createdUserIds]);
        await dbConn.query('DELETE FROM orders WHERE user_id IN (?)', [createdUserIds]);
        await dbConn.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
      } catch (err) {
        console.error('Error cleaning up test users:', err.message);
      }
    }

    if (dbConn) {
      await dbConn.end();
    }

    if (inProcessServer) {
      await new Promise((resolve) => inProcessServer.close(resolve));
      // End global pool if inProcessServer was started
      await pool.end().catch(() => {});
    }
  });

  // ============================================================================
  // SUITE 1: CUSTOMER BROWSE, FILTER, VARIANT SELECTION & COD PURCHASE
  // ============================================================================
  describe('1. Customer Purchase Journey Verification', () => {
    let selectedVariant;

    it('1.1 Can browse and filter products with multi-attribute criteria', async () => {
      const res = await client.get('/api/v1/products', {
        query: {
          categoryId: 1,
          size: 'M',
          minPrice: 15,
          maxPrice: 150,
          inStock: 'true',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Products should be an array');
      assert.ok(res.body.data.length > 0, 'Should find products matching filter');

      // Pick a variant from the returned list
      for (const prod of res.body.data) {
        const found = prod.variants.find((v) => v.size === 'M' && Number(v.stock_quantity) >= 5 && v.is_active);
        if (found) {
          selectedVariant = found;
          break;
        }
      }
      assert.ok(selectedVariant, 'Should find an active M variant with stock >= 5');
    });

    it('1.2 Can complete order using Cash on Delivery (COD)', async () => {
      const checkoutPayload = {
        shipping_address: {
          recipient_name: 'Adversarial Tester',
          phone: '+8801999887766',
          street_address: 'Road 5, Block B',
          city: 'Dhaka',
          postal_code: '1212',
          country: 'Bangladesh',
        },
        payment_method: 'cash_on_delivery',
        notes: 'COD Journey Test Order',
        items: [
          {
            variant_id: selectedVariant.id,
            quantity: 1,
          },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', checkoutPayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 201, `Expected 201 Created on checkout, got: ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id > 0);
      assert.equal(res.body.data.payment_method, 'cash_on_delivery');
      assert.equal(res.body.data.payment_status, 'unpaid');
      assert.equal(res.body.data.status, 'pending');

      createdOrderIds.push(res.body.data.id);
    });
  });

  // ============================================================================
  // SUITE 2: ATOMIC ROLLBACK ON INVALID / OUT-OF-STOCK CHECKOUTS
  // ============================================================================
  describe('2. Stress Test: Atomic Rollback on Invalid / Out-of-Stock Checkouts', () => {
    let testProduct;
    let variantLowStock;
    let variantAbundant;
    let variantInactive;

    before(async () => {
      // Find an existing product
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      assert.ok(prods.length > 0);
      testProduct = prods[0];

      // Create dedicated test variants directly in DB:
      // 1. Low stock variant (stock = 1)
      const skuLow = `STRESS-LOW-${Date.now()}`;
      const [resLow] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'S', 'Crimson', 49.99, 1, 1)`,
        [testProduct.id, skuLow]
      );
      variantLowStock = { id: resLow.insertId, sku: skuLow, stock_quantity: 1, price: 49.99 };
      createdVariantIds.push(resLow.insertId);

      // 2. Abundant stock variant (stock = 20)
      const skuAbundant = `STRESS-ABUNDANT-${Date.now()}`;
      const [resAbundant] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'M', 'Crimson', 49.99, 20, 1)`,
        [testProduct.id, skuAbundant]
      );
      variantAbundant = { id: resAbundant.insertId, sku: skuAbundant, stock_quantity: 20, price: 49.99 };
      createdVariantIds.push(resAbundant.insertId);

      // 3. Inactive variant (is_active = 0)
      const skuInactive = `STRESS-INACTIVE-${Date.now()}`;
      const [resInactive] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'L', 'Crimson', 49.99, 10, 0)`,
        [testProduct.id, skuInactive]
      );
      variantInactive = { id: resInactive.insertId, sku: skuInactive, stock_quantity: 10, price: 49.99 };
      createdVariantIds.push(resInactive.insertId);
    });

    it('2.1 Single-item overstock checkout returns HTTP 400 and performs atomic rollback', async () => {
      // Record initial baseline
      const [[orderCountBefore]] = await dbConn.query('SELECT COUNT(*) AS c FROM orders');
      const [[itemCountBefore]] = await dbConn.query('SELECT COUNT(*) AS c FROM order_items');
      const [[movCountBefore]] = await dbConn.query('SELECT COUNT(*) AS c FROM inventory_movements');
      const [[varBefore]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLowStock.id]);
      assert.equal(varBefore.stock_quantity, 1);

      // Attempt checkout of quantity 5 (available: 1)
      const overstockPayload = {
        shipping_address: {
          recipient_name: 'Overstock Tester',
          phone: '+8801999887766',
          street_address: '123 Test Road',
          city: 'Dhaka',
          postal_code: '1200',
        },
        payment_method: 'cash_on_delivery',
        items: [
          {
            variant_id: variantLowStock.id,
            quantity: 5,
          },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', overstockPayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, false);
      assert.ok(
        res.body.message.toLowerCase().includes('stock') ||
        res.body.message.toLowerCase().includes('available'),
        'Error message should indicate insufficient stock'
      );

      // Invariant Check: Verify NO database mutations occurred (strict atomic rollback)
      const [[orderCountAfter]] = await dbConn.query('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?', [testCustomerId]);
      const [[movAfter]] = await dbConn.query('SELECT COUNT(*) AS c FROM inventory_movements WHERE variant_id = ?', [variantLowStock.id]);
      const [[varAfter]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLowStock.id]);

      assert.equal(movAfter.c, 0, 'Atomic rollback invariant: no inventory_movements logged for failed variant');
      assert.equal(varAfter.stock_quantity, 1, 'Atomic rollback invariant: stock_quantity must remain unchanged at 1');
    });

    it('2.2 Multi-item checkout with 1 in-stock and 1 out-of-stock rolls back both atomically', async () => {
      // Record baseline for abundant variant and low-stock variant
      const [[varAbundantBefore]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantAbundant.id]);
      const [[varLowBefore]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLowStock.id]);
      const [[orderCountBefore]] = await dbConn.query('SELECT COUNT(*) AS c FROM orders');
      const [[movCountBefore]] = await dbConn.query('SELECT COUNT(*) AS c FROM inventory_movements');

      assert.equal(varAbundantBefore.stock_quantity, 20);
      assert.equal(varLowBefore.stock_quantity, 1);

      // Attempt to purchase 2 units of abundant (valid) + 3 units of low-stock (invalid)
      const mixedPayload = {
        shipping_address: {
          recipient_name: 'Mixed Batch Tester',
          phone: '+8801999887766',
          street_address: '456 Mixed Way',
          city: 'Dhaka',
          postal_code: '1205',
        },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: variantAbundant.id, quantity: 2 },
          { variant_id: variantLowStock.id, quantity: 3 },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', mixedPayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
      assert.equal(res.body.success, false);

      // INVARIANT AUDIT:
      // Abundant variant stock MUST NOT be decremented even though it had sufficient stock!
      const [[varAbundantAfter]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantAbundant.id]);
      const [[varLowAfter]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLowStock.id]);
      const [[movRows]] = await dbConn.query('SELECT COUNT(*) AS c FROM inventory_movements WHERE variant_id IN (?, ?)', [variantAbundant.id, variantLowStock.id]);

      assert.equal(
        varAbundantAfter.stock_quantity,
        20,
        'CRITICAL INVARIANT: Abundant stock must remain 20, cannot partially commit!'
      );
      assert.equal(varLowAfter.stock_quantity, 1, 'Low stock must remain 1');
      assert.equal(movRows.c, 0, 'No inventory movements should be logged for either variant');
    });

    it('2.3 Inactive variant checkout attempt returns HTTP 400 and rolls back atomically', async () => {
      const inactivePayload = {
        shipping_address: {
          recipient_name: 'Inactive Tester',
          phone: '+8801999887766',
          street_address: '789 Inactive Lane',
          city: 'Dhaka',
          postal_code: '1210',
        },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: variantInactive.id, quantity: 1 },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', inactivePayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 400, `Expected 400 Bad Request on inactive variant, got ${res.status}`);
      assert.equal(res.body.success, false);
      assert.ok(res.body.message.toLowerCase().includes('active'), `Message must indicate inactive/not active, got: ${res.body.message}`);
    });
  });

  // ============================================================================
  // SUITE 3: VARIANT SNAPSHOTS IN ORDER_ITEMS
  // ============================================================================
  describe('3. Variant Snapshot Verification in order_items', () => {
    let snapshotOrderId;
    const testSku = `SNAP-${Date.now()}`;
    let testVariant;

    before(async () => {
      // Create unique variant for snapshot auditing
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const [resVar] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'XL', 'Emerald Green', 59.50, 10, 1)`,
        [prods[0].id, testSku]
      );
      testVariant = {
        id: resVar.insertId,
        productId: prods[0].id,
        sku: testSku,
        size: 'XL',
        color: 'Emerald Green',
        price: 59.50,
        stock_quantity: 10,
      };
      createdVariantIds.push(resVar.insertId);
    });

    it('3.1 Successful checkout captures variant snapshots in order_items (size, color, unit_price, quantity, subtotal)', async () => {
      const checkoutPayload = {
        shipping_address: {
          recipient_name: 'Snapshot Auditor',
          phone: '+8801999887766',
          street_address: 'Snapshot Ave 10',
          city: 'Dhaka',
          postal_code: '1212',
        },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: testVariant.id, quantity: 2 },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', checkoutPayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 201);
      snapshotOrderId = res.body.data.id;
      createdOrderIds.push(snapshotOrderId);

      // Query direct database row in `order_items`
      const [rows] = await dbConn.query(
        'SELECT * FROM order_items WHERE order_id = ? AND variant_id = ?',
        [snapshotOrderId, testVariant.id]
      );

      assert.equal(rows.length, 1, 'Exact 1 order_items row must exist for variant');
      const item = rows[0];

      // Audit snapshot requirements:
      // 1. size
      assert.equal(item.size, 'XL', 'Snapshot column `size` must match variant size');
      assert.equal(item.variant_size, 'XL', 'Dual-write column `variant_size` must match');

      // 2. color
      assert.equal(item.color, 'Emerald Green', 'Snapshot column `color` must match variant color');
      assert.equal(item.variant_color, 'Emerald Green', 'Dual-write column `variant_color` must match');

      // 3. unit_price
      assert.equal(Number(item.unit_price), 59.50, 'Snapshot column `unit_price` must match variant price');

      // 4. quantity
      assert.equal(Number(item.quantity), 2, 'Snapshot column `quantity` must match purchased quantity (2)');

      // 5. subtotal
      const expectedSubtotal = Number((59.50 * 2).toFixed(2));
      assert.equal(Number(item.subtotal), expectedSubtotal, `Snapshot column subtotal must be ${expectedSubtotal}`);
      assert.equal(Number(item.line_total), expectedSubtotal, `Dual-write column line_total must be ${expectedSubtotal}`);

      // 6. Sku snapshot
      assert.equal(item.variant_sku, testSku, 'Snapshot `variant_sku` must match');
    });
  });

  // ============================================================================
  // SUITE 4: EXACT STOCK DECREMENT & INVENTORY_MOVEMENTS AUDIT LOGGING
  // ============================================================================
  describe('4. Exact Stock Decrement and Inventory Movements Delta Audit', () => {
    let auditVariant;
    const initialQty = 15;
    const purchaseQty = 4;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const sku = `AUDIT-STK-${Date.now()}`;
      const [resVar] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'L', 'Charcoal Grey', 35.00, ?, 1)`,
        [prods[0].id, sku, initialQty]
      );
      auditVariant = { id: resVar.insertId, sku, initialQty };
      createdVariantIds.push(resVar.insertId);
    });

    it('4.1 Variant stock decrements by exact purchased quantity and logs inventory_movements with reason = order_placed', async () => {
      const checkoutPayload = {
        shipping_address: {
          recipient_name: 'Audit Decrement Tester',
          phone: '+8801999887766',
          street_address: 'Audit Blvd 99',
          city: 'Chittagong',
          postal_code: '4000',
        },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: auditVariant.id, quantity: purchaseQty },
        ],
      };

      const res = await client.post('/api/v1/checkout/orders', checkoutPayload, {
        token: testCustomerToken,
      });

      assert.equal(res.status, 201);
      const orderId = res.body.data.id;
      createdOrderIds.push(orderId);

      // Verify stock decrement in product_variants
      const [[varRow]] = await dbConn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ?',
        [auditVariant.id]
      );

      const expectedRemaining = initialQty - purchaseQty;
      assert.equal(
        Number(varRow.stock_quantity),
        expectedRemaining,
        `Stock must decrement from ${initialQty} to ${expectedRemaining}`
      );

      // Verify inventory_movements audit trail row
      const [movRows] = await dbConn.query(
        'SELECT * FROM inventory_movements WHERE reference_order_id = ? AND variant_id = ?',
        [orderId, auditVariant.id]
      );

      assert.equal(movRows.length, 1, 'Exact 1 inventory_movements row must be logged for this order variant');
      const movement = movRows[0];

      assert.equal(movement.reason, 'order_placed', 'inventory_movements.reason must be `order_placed`');
      assert.equal(Number(movement.quantity_delta), -purchaseQty, `quantity_delta must be -${purchaseQty}`);
      assert.equal(Number(movement.before_quantity), initialQty, `before_quantity must be ${initialQty}`);
      assert.equal(Number(movement.after_quantity), expectedRemaining, `after_quantity must be ${expectedRemaining}`);
      assert.equal(movement.actor_id, testCustomerId, 'actor_id must be customer ID');
    });
  });

  // ============================================================================
  // SUITE 5: CART ITEMS EMPTIED UPON CHECKOUT COMPLETION
  // ============================================================================
  describe('5. Cart Items Emptied Upon Checkout Completion', () => {
    let cartVariant1;
    let cartVariant2;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const sku1 = `CART-V1-${Date.now()}`;
      const sku2 = `CART-V2-${Date.now()}`;

      const [res1] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'S', 'Amber', 25.00, 10, 1)`,
        [prods[0].id, sku1]
      );
      const [res2] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'M', 'Amber', 25.00, 10, 1)`,
        [prods[0].id, sku2]
      );

      cartVariant1 = { id: res1.insertId, sku: sku1 };
      cartVariant2 = { id: res2.insertId, sku: sku2 };
      createdVariantIds.push(res1.insertId, res2.insertId);

      // Clear any prior cart items for test customer
      await dbConn.query('DELETE FROM cart_items WHERE user_id = ?', [testCustomerId]);
    });

    it('5.1 Adds multiple items to cart, checks out, and asserts cart items are completely emptied', async () => {
      // 1. Add variant 1 to cart
      const add1 = await client.post(
        '/api/v1/cart',
        { variant_id: cartVariant1.id, quantity: 1 },
        { token: testCustomerToken }
      );
      assert.equal(add1.status, 200);

      // 2. Add variant 2 to cart
      const add2 = await client.post(
        '/api/v1/cart',
        { variant_id: cartVariant2.id, quantity: 2 },
        { token: testCustomerToken }
      );
      assert.equal(add2.status, 200);

      // Confirm cart contains 2 items
      const cartBefore = await client.get('/api/v1/cart', { token: testCustomerToken });
      assert.equal(cartBefore.status, 200);
      assert.equal(cartBefore.body.data.items.length, 2);

      // 3. Checkout using cart items (without passing explicit items in body)
      const checkoutRes = await client.post(
        '/api/v1/orders',
        {
          shipping_address: {
            recipient_name: 'Cart Empty Tester',
            phone: '+8801999887766',
            street_address: 'Empty Cart Way 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          notes: 'Test cart cleanup on checkout',
        },
        { token: testCustomerToken }
      );

      assert.equal(checkoutRes.status, 201);
      const orderId = checkoutRes.body.data.id;
      createdOrderIds.push(orderId);

      // 4. Invariant Verification in DB: cart_items must be empty
      const [dbCartRows] = await dbConn.query('SELECT * FROM cart_items WHERE user_id = ?', [testCustomerId]);
      assert.equal(
        dbCartRows.length,
        0,
        'CRITICAL INVARIANT: Database cart_items table must have 0 rows for user after checkout'
      );

      // 5. Invariant Verification via API: GET /api/v1/cart must return empty items array
      const cartAfter = await client.get('/api/v1/cart', { token: testCustomerToken });
      assert.equal(cartAfter.status, 200);
      assert.equal(cartAfter.body.data.items.length, 0, 'Cart items array must be empty');
      assert.equal(Number(cartAfter.body.data.summary.total_items), 0);
    });
  });

  // ============================================================================
  // SUITE 6: HIGH-CONCURRENCY RACE CONDITION & INVENTORY PRESERVATION STRESS
  // ============================================================================
  describe('6. High-Concurrency Stress: Race Condition on Limited Inventory', () => {
    let raceVariant;
    const raceInitialStock = 2;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const sku = `RACE-STK-${Date.now()}`;
      const [resVar] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'XL', 'Race Red', 50.00, ?, 1)`,
        [prods[0].id, sku, raceInitialStock]
      );
      raceVariant = { id: resVar.insertId, sku };
      createdVariantIds.push(resVar.insertId);
    });

    it('6.1 4 concurrent checkout requests competing for 2 units: exactly 1 succeeds, 3 fail with 400, stock cannot go negative', async () => {
      const checkoutPayload = {
        shipping_address: {
          recipient_name: 'Race Challenger',
          phone: '+8801999887766',
          street_address: 'Race Track 1',
          city: 'Dhaka',
          postal_code: '1212',
        },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: raceVariant.id, quantity: 2 },
        ],
      };

      // Fire 4 parallel checkouts at the exact same millisecond
      const promises = [
        client.post('/api/v1/checkout/orders', checkoutPayload, { token: testCustomerToken }),
        client.post('/api/v1/checkout/orders', checkoutPayload, { token: testCustomerToken }),
        client.post('/api/v1/checkout/orders', checkoutPayload, { token: testCustomerToken }),
        client.post('/api/v1/checkout/orders', checkoutPayload, { token: testCustomerToken }),
      ];

      const results = await Promise.all(promises);

      const successResponses = results.filter((r) => r.status === 201);
      const failedResponses = results.filter((r) => r.status === 400);

      // Track any created orders
      for (const s of successResponses) {
        if (s.body && s.body.data && s.body.data.id) {
          createdOrderIds.push(s.body.data.id);
        }
      }

      assert.equal(
        successResponses.length,
        1,
        `CONCURRENCY INVARIANT: Exactly 1 checkout must succeed. Succeeded: ${successResponses.length}`
      );
      assert.equal(
        failedResponses.length,
        3,
        `CONCURRENCY INVARIANT: Exactly 3 checkouts must fail with HTTP 400. Failed: ${failedResponses.length}`
      );

      // INVARIANT: Final stock in MySQL must be exactly 0, NEVER negative
      const [[varRow]] = await dbConn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ?',
        [raceVariant.id]
      );
      assert.equal(
        Number(varRow.stock_quantity),
        0,
        'CONCURRENCY INVARIANT: Stock quantity must be exactly 0 (no negative stock)'
      );

      // INVARIANT: Exactly 1 inventory_movements record logged for this variant
      const [movRows] = await dbConn.query(
        'SELECT * FROM inventory_movements WHERE variant_id = ? AND reason = "order_placed"',
        [raceVariant.id]
      );
      assert.equal(
        movRows.length,
        1,
        'CONCURRENCY INVARIANT: Exactly 1 inventory movement must be recorded'
      );
    });
  });

  // ============================================================================
  // SUITE 7: COD ORDER CANCELLATION & STOCK RESTORATION
  // ============================================================================
  describe('7. COD Order Lifecycle: Cancellation Stock Restoration', () => {
    let cancelVariant;
    let cancelOrderId;
    const initialCancelStock = 10;
    const cancelPurchaseQty = 3;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const sku = `CANCEL-STK-${Date.now()}`;
      const [resVar] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'M', 'Ocean Blue', 40.00, ?, 1)`,
        [prods[0].id, sku, initialCancelStock]
      );
      cancelVariant = { id: resVar.insertId, sku };
      createdVariantIds.push(resVar.insertId);

      // Place order
      const orderRes = await client.post(
        '/api/v1/orders',
        {
          shipping_address: {
            recipient_name: 'Cancel Tester',
            phone: '+8801999887766',
            street_address: 'Cancel Street 4',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          items: [{ variant_id: cancelVariant.id, quantity: cancelPurchaseQty }],
        },
        { token: testCustomerToken }
      );
      assert.equal(orderRes.status, 201);
      cancelOrderId = orderRes.body.data.id;
      createdOrderIds.push(cancelOrderId);

      // Confirm stock was decremented to 7
      const [[midVar]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [cancelVariant.id]);
      assert.equal(Number(midVar.stock_quantity), 7);
    });

    it('7.1 Customer cancels pending order: stock is restored and inventory_movements logs order_cancelled', async () => {
      const cancelRes = await client.post(
        `/api/v1/orders/${cancelOrderId}/cancel`,
        { reason: 'Customer changed mind' },
        { token: testCustomerToken }
      );

      assert.equal(cancelRes.status, 200, `Expected 200 on cancel, got ${cancelRes.status}`);
      assert.equal(cancelRes.body.success, true);
      assert.equal(cancelRes.body.data.status, 'cancelled');

      // Verify stock in product_variants restored back to initial 10
      const [[afterVar]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [cancelVariant.id]);
      assert.equal(
        Number(afterVar.stock_quantity),
        initialCancelStock,
        `Variant stock must be restored to ${initialCancelStock}`
      );

      // Verify inventory_movements logs reason = 'order_cancelled'
      const [cancelMov] = await dbConn.query(
        'SELECT * FROM inventory_movements WHERE reference_order_id = ? AND reason = "order_cancelled"',
        [cancelOrderId]
      );
      assert.equal(cancelMov.length, 1);
      assert.equal(Number(cancelMov[0].quantity_delta), cancelPurchaseQty);
      assert.equal(Number(cancelMov[0].before_quantity), 7);
      assert.equal(Number(cancelMov[0].after_quantity), initialCancelStock);
    });

    it('7.2 Terminal state protection: Cannot cancel after reaching delivered status', async () => {
      // Create a delivered order
      const [orderRes] = await dbConn.query(
        `INSERT INTO orders (order_number, user_id, subtotal, shipping_fee, total_amount, status, payment_method, payment_status, shipping_address)
         VALUES (?, ?, 100, 0, 100, 'delivered', 'cash_on_delivery', 'paid', '{"city":"Dhaka"}')`,
        [`ECO-TERM-${Date.now()}`, testCustomerId]
      );
      const deliveredOrderId = orderRes.insertId;
      createdOrderIds.push(deliveredOrderId);

      const cancelRes = await client.post(
        `/api/v1/orders/${deliveredOrderId}/cancel`,
        { reason: 'Too late' },
        { token: testCustomerToken }
      );

      assert.equal(cancelRes.status, 400);
      assert.equal(cancelRes.body.success, false);
      assert.ok(cancelRes.body.message.toLowerCase().includes('cannot be cancelled'), `Expected cannot be cancelled message, got: ${cancelRes.body.message}`);
    });
  });

  // ============================================================================
  // SUITE 8: CONCURRENT MULTI-ITEM DEADLOCK IMMUNITY STRESS
  // ============================================================================
  describe('8. High-Concurrency Stress: Reverse-Order Deadlock Immunity', () => {
    let variantAlpha;
    let variantBeta;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const skuA = `DEADLOCK-A-${Date.now()}`;
      const skuB = `DEADLOCK-B-${Date.now()}`;

      const [resA] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'S', 'Silver', 50.00, 10, 1)`,
        [prods[0].id, skuA]
      );
      const [resB] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'M', 'Gold', 50.00, 10, 1)`,
        [prods[0].id, skuB]
      );

      // Guarantee ID ordering: Alpha has lower ID, Beta has higher ID
      if (resA.insertId < resB.insertId) {
        variantAlpha = { id: resA.insertId, sku: skuA };
        variantBeta = { id: resB.insertId, sku: skuB };
      } else {
        variantAlpha = { id: resB.insertId, sku: skuB };
        variantBeta = { id: resA.insertId, sku: skuA };
      }
      createdVariantIds.push(resA.insertId, resB.insertId);
    });

    it('8.1 Concurrent reverse-order checkouts [Beta, Alpha] and [Alpha, Beta] execute without deadlock', async () => {
      const payloadClient1 = {
        shipping_address: { recipient_name: 'P1', phone: '017', street_address: 'W1', city: 'Dhaka', postal_code: '12' },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: variantBeta.id, quantity: 1 },
          { variant_id: variantAlpha.id, quantity: 1 },
        ],
      };

      const payloadClient2 = {
        shipping_address: { recipient_name: 'P2', phone: '018', street_address: 'W2', city: 'Dhaka', postal_code: '12' },
        payment_method: 'cash_on_delivery',
        items: [
          { variant_id: variantAlpha.id, quantity: 1 },
          { variant_id: variantBeta.id, quantity: 1 },
        ],
      };

      // Both fire simultaneously with crossed ordering
      const [r1, r2] = await Promise.all([
        client.post('/api/v1/checkout/orders', payloadClient1, { token: testCustomerToken }),
        client.post('/api/v1/checkout/orders', payloadClient2, { token: testCustomerToken }),
      ]);

      assert.equal(r1.status, 201, `Client 1 should succeed without deadlock: ${JSON.stringify(r1.body)}`);
      assert.equal(r2.status, 201, `Client 2 should succeed without deadlock: ${JSON.stringify(r2.body)}`);

      createdOrderIds.push(r1.body.data.id, r2.body.data.id);

      // Verify final stock is exactly 8 for both variants (10 - 1 - 1 = 8)
      const [[stkA]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantAlpha.id]);
      const [[stkB]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantBeta.id]);
      assert.equal(Number(stkA.stock_quantity), 8);
      assert.equal(Number(stkB.stock_quantity), 8);
    });
  });

  // ============================================================================
  // SUITE 9: GUEST COD CHECKOUT WITH SNAPSHOTS & DATA INTEGRITY
  // ============================================================================
  describe('9. Guest COD Checkout & Snapshot Integrity', () => {
    let guestVariant;
    const initialGuestStock = 6;

    before(async () => {
      const [prods] = await dbConn.query('SELECT id, name FROM products WHERE is_active = 1 LIMIT 1');
      const sku = `GUEST-STK-${Date.now()}`;
      const [resVar] = await dbConn.query(
        `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
         VALUES (?, ?, 'XS', 'Sand', 45.00, ?, 1)`,
        [prods[0].id, sku, initialGuestStock]
      );
      guestVariant = { id: resVar.insertId, sku };
      createdVariantIds.push(resVar.insertId);
    });

    it('9.1 Guest can complete COD checkout without JWT and snapshots are captured', async () => {
      const guestPayload = {
        guest_email: 'guest_auditor@test.com',
        shipping_address: {
          recipient_name: 'Guest Auditor',
          phone: '+8801555112233',
          street_address: 'Guest Lane 7',
          city: 'Sylhet',
          postal_code: '3100',
        },
        payment_method: 'cash_on_delivery',
        notes: 'Guest COD verification order',
        items: [
          { variant_id: guestVariant.id, quantity: 2 },
        ],
      };

      // Notice NO token passed
      const res = await client.post('/api/v1/checkout/orders', guestPayload);

      assert.equal(res.status, 201, `Guest checkout should return 201 Created: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user_id, null, 'user_id should be null for guest order');
      assert.equal(res.body.data.payment_method, 'cash_on_delivery');
      assert.equal(res.body.data.payment_status, 'unpaid');

      const guestOrderId = res.body.data.id;
      createdOrderIds.push(guestOrderId);

      // Verify snapshots in order_items
      const [items] = await dbConn.query('SELECT * FROM order_items WHERE order_id = ?', [guestOrderId]);
      assert.equal(items.length, 1);
      assert.equal(items[0].size, 'XS');
      assert.equal(items[0].color, 'Sand');
      assert.equal(Number(items[0].unit_price), 45.00);
      assert.equal(Number(items[0].quantity), 2);
      assert.equal(Number(items[0].subtotal), 90.00);

      // Verify inventory_movements actor_id is null for guest
      const [mov] = await dbConn.query('SELECT * FROM inventory_movements WHERE reference_order_id = ?', [guestOrderId]);
      assert.equal(mov.length, 1);
      assert.equal(mov[0].reason, 'order_placed');
      assert.equal(mov[0].actor_id, null);
      assert.equal(Number(mov[0].quantity_delta), -2);

      // Verify stock decremented to 4
      const [[vRow]] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [guestVariant.id]);
      assert.equal(Number(vRow.stock_quantity), 4);
    });
  });
});
