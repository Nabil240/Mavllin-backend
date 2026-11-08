const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('../../backend/node_modules/mysql2/promise');
const env = require('../../backend/src/config/env');
const { ApiClient } = require('./helpers/api-client');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const client = new ApiClient(BASE_URL);

describe('Full MVP End-to-End Test Suite: Customer Journey & Admin Flow', () => {
  let dbConn;
  let inProcessServer = null;

  // Shared state between stages
  const timestamp = Date.now();
  const customerAEmail = `e2e_cust_${timestamp}@projecteco.test`;
  const customerBEmail = `e2e_other_${timestamp}@projecteco.test`;
  const customerPassword = 'Customer@123';
  const adminEmail = 'admin@projecteco.com';
  const adminPassword = 'Admin@123';

  let customerAId;
  let customerBId;
  let customerToken;
  let customerBToken;
  let adminToken;

  let targetProductId;
  let targetVariantId;
  let targetVariantSku;
  let targetVariantSize;
  let targetVariantColor;
  let targetVariantPrice;
  let initialStock;

  let createdOrderId;
  let createdOrderNumber;
  let expectedSubtotal;
  let expectedShippingFee;
  let expectedTotalAmount;

  before(async () => {
    // 1. Establish direct MySQL database connection for invariant auditing
    dbConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });

    // 2. Ensure target API server is responding; if not, spin up in-process Express listener
    let serverResponding = false;
    try {
      const probe = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
      if (probe.ok) {
        serverResponding = true;
      }
    } catch (_err) {
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
  });

  after(async () => {
    // Clean up test orders and audit records
    if (createdOrderId) {
      try {
        await dbConn.query('DELETE FROM payments WHERE order_id = ?', [createdOrderId]);
        await dbConn.query('DELETE FROM order_status_history WHERE order_id = ?', [createdOrderId]);
        await dbConn.query('DELETE FROM order_items WHERE order_id = ?', [createdOrderId]);
        await dbConn.query('DELETE FROM inventory_movements WHERE reference_order_id = ?', [createdOrderId]);
        await dbConn.query('DELETE FROM orders WHERE id = ?', [createdOrderId]);
      } catch (err) {
        console.error('Failed to clean up test order:', err.message);
      }
    }

    // Clean up test customer accounts
    if (customerAId || customerBId) {
      try {
        const userIds = [customerAId, customerBId].filter(Boolean);
        if (userIds.length > 0) {
          await dbConn.query('DELETE FROM cart_items WHERE user_id IN (?)', [userIds]);
          await dbConn.query('DELETE FROM orders WHERE user_id IN (?)', [userIds]);
          await dbConn.query('DELETE FROM users WHERE id IN (?)', [userIds]);
        }
      } catch (err) {
        console.error('Failed to clean up test users:', err.message);
      }
    }

    // Close direct DB connection
    if (dbConn) {
      await dbConn.end();
    }

    // Close in-process server if we started one
    if (inProcessServer) {
      await new Promise((resolve) => inProcessServer.close(resolve));
    }
  });

  // ============================================================================
  // PART 1: CUSTOMER PURCHASE JOURNEY
  // ============================================================================
  describe('Part 1: Customer Purchase Journey', () => {

    it('1.1 Browse catalog (GET /api/v1/products) & verify pagination and active items', async () => {
      const res = await client.get('/api/v1/products', { query: { page: 1, limit: 10 } });

      assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected data to be an array');
      assert.ok(res.body.data.length > 0, 'Expected at least 1 product');

      // Verify pagination meta
      const meta = res.body.meta;
      assert.ok(meta, 'Meta object must exist');
      assert.equal(meta.page, 1);
      assert.equal(meta.limit, 10);
      assert.ok(meta.total > 0, 'Total products must be > 0');
      assert.ok(meta.totalPages >= 1, 'Total pages must be >= 1');

      // Verify active products have variants and active attributes
      for (const product of res.body.data) {
        assert.ok(product.id, 'Product must have an id');
        assert.ok(product.name, 'Product must have a name');
        assert.ok(product.slug, 'Product must have a slug');
        assert.ok(Number(product.base_price) >= 0, 'Product base_price must be >= 0');
        assert.ok(Array.isArray(product.variants), 'Product variants must be an array');
        assert.ok(product.is_active === 1 || product.is_active === true, 'Product must be active');
      }
    });

    it('1.2 Multi-attribute filtering (GET /api/v1/products with category, size, color, price bounds)', async () => {
      // Filter by categoryId=1 (Men\'s Apparel), size=M, color=Navy Blue, price between 20 and 100
      const res = await client.get('/api/v1/products', {
        query: {
          categoryId: 1,
          size: 'M',
          color: 'Navy Blue',
          minPrice: 20,
          maxPrice: 100,
          inStock: 'true',
        },
      });

      assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Expected filtered data to be an array');
      assert.ok(res.body.data.length > 0, 'Expected filtered products matching criteria');

      // Assert that every returned product possesses at least one matching active variant
      for (const product of res.body.data) {
        const hasMatchingVariant = product.variants.some((v) => {
          const matchSize = !v.size || v.size.toLowerCase() === 'm';
          const matchColor = !v.color || v.color.toLowerCase().includes('navy');
          const vPrice = Number(v.price || product.base_price);
          const matchPrice = vPrice >= 20 && vPrice <= 100;
          const matchStock = Number(v.stock_quantity) > 0;
          return matchSize && matchColor && matchPrice && matchStock;
        });
        assert.ok(hasMatchingVariant, `Product ${product.name} must have at least one variant matching filters`);
      }
    });

    it('1.3 Fetch product detail (GET /api/v1/products/:idOrSlug) & select a variant with stock', async () => {
      // Query specific apparel product by slug
      const slug = 'organic-classic-crewneck-tee';
      const res = await client.get(`/api/v1/products/${slug}`);

      assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data, 'Product data must not be empty');
      assert.equal(res.body.data.slug, slug);
      assert.ok(Array.isArray(res.body.data.variants), 'Variants must be an array');
      assert.ok(res.body.data.variants.length >= 2, 'Product must have multiple variants');

      // Find an active variant with sufficient stock for purchasing
      const selected = res.body.data.variants.find((v) => Number(v.stock_quantity) >= 5 && v.is_active);
      assert.ok(selected, 'Must find an active variant with stock_quantity >= 5');

      targetProductId = res.body.data.id;
      targetVariantId = selected.id;
      targetVariantSku = selected.sku;
      targetVariantSize = selected.size;
      targetVariantColor = selected.color;
      targetVariantPrice = Number(selected.price);
      initialStock = Number(selected.stock_quantity);

      assert.ok(targetVariantId > 0, 'Target variant ID must be positive integer');
      assert.ok(targetVariantPrice > 0, 'Target variant price must be > 0');
      assert.ok(initialStock >= 5, 'Initial stock must be >= 5');
    });

    it('1.4 Customer authentication: register and login customer', async () => {
      // 1. Register Customer A
      const regRes = await client.post('/api/v1/auth/register', {
        full_name: 'Tariqul Islam',
        email: customerAEmail,
        password: customerPassword,
        phone: '+8801711998877',
      });

      assert.equal(regRes.status, 201, `Expected 201 Created on register, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
      assert.equal(regRes.body.success, true);
      assert.ok(regRes.body.data.user, 'Registered user object must exist');
      customerAId = regRes.body.data.user.id;
      assert.equal(regRes.body.data.user.role, 'customer');

      // 2. Login Customer A
      const loginRes = await client.post('/api/v1/auth/login', {
        email: customerAEmail,
        password: customerPassword,
      });

      assert.equal(loginRes.status, 200, `Expected 200 OK on login, got ${loginRes.status}`);
      assert.equal(loginRes.body.success, true);
      assert.ok(typeof loginRes.body.data.token === 'string', 'Login must return JWT token string');
      customerToken = loginRes.body.data.token;
      assert.equal(loginRes.body.data.user.role, 'customer');

      // 3. Register Customer B (for access control checks)
      const regBRes = await client.post('/api/v1/auth/register', {
        full_name: 'Customer B Adversary',
        email: customerBEmail,
        password: customerPassword,
        phone: '+8801722887766',
      });
      assert.equal(regBRes.status, 201);
      customerBId = regBRes.body.data.user.id;

      const loginBRes = await client.post('/api/v1/auth/login', {
        email: customerBEmail,
        password: customerPassword,
      });
      assert.equal(loginBRes.status, 200);
      customerBToken = loginBRes.body.data.token;
    });

    it('1.5 Cart management: add variant, update quantity, retrieve cart, verify stock defense', async () => {
      // 1.5a Add variant to cart with quantity 2
      const addRes = await client.post(
        '/api/v1/cart',
        { variant_id: targetVariantId, quantity: 2 },
        { token: customerToken }
      );

      assert.equal(addRes.status, 200, `Expected 200 OK on add to cart, got ${addRes.status}: ${JSON.stringify(addRes.body)}`);
      assert.equal(addRes.body.success, true);
      assert.ok(Array.isArray(addRes.body.data.items), 'Cart items must be an array');
      const addedItem = addRes.body.data.items.find((i) => i.variant_id === targetVariantId);
      assert.ok(addedItem, 'Cart must contain added variant item');
      assert.equal(addedItem.quantity, 2);
      assert.equal(Number(addedItem.unit_price), targetVariantPrice);

      // 1.5b Update cart quantity to 3
      const updateRes = await client.put(
        `/api/v1/cart/items/${targetVariantId}`,
        { quantity: 3 },
        { token: customerToken }
      );

      assert.equal(updateRes.status, 200, `Expected 200 OK on update cart, got ${updateRes.status}`);
      assert.equal(updateRes.body.success, true);
      const updatedItem = updateRes.body.data.items.find((i) => i.variant_id === targetVariantId);
      assert.ok(updatedItem, 'Cart must contain updated item');
      assert.equal(updatedItem.quantity, 3);

      // 1.5c Retrieve cart and verify subtotal calculations
      const getRes = await client.get('/api/v1/cart', { token: customerToken });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.success, true);
      assert.equal(getRes.body.data.items.length, 1);
      const currentItem = getRes.body.data.items[0];
      assert.equal(currentItem.quantity, 3);
      const expectedLineTotal = Number((targetVariantPrice * 3).toFixed(2));
      assert.equal(Number(currentItem.line_total), expectedLineTotal);
      assert.equal(Number(getRes.body.data.summary.subtotal), expectedLineTotal);

      // 1.5d Cart Stock Boundary Defense: attempt to add impossible stock (99999)
      const overstockRes = await client.post(
        '/api/v1/cart',
        { variant_id: targetVariantId, quantity: 99999 },
        { token: customerToken }
      );
      assert.equal(overstockRes.status, 400, `Expected 400 Bad Request on overstock, got ${overstockRes.status}`);
      assert.equal(overstockRes.body.success, false);
      assert.ok(
        overstockRes.body.message.toLowerCase().includes('stock') ||
        overstockRes.body.message.toLowerCase().includes('available'),
        'Message must indicate insufficient stock'
      );
    });

    it('1.6 COD Checkout: place order with cash_on_delivery and verify response', async () => {
      expectedSubtotal = Number((targetVariantPrice * 3).toFixed(2));
      // Dhaka shipping rule: subtotal >= 100 -> 0.00, subtotal < 100 -> 5.00
      expectedShippingFee = expectedSubtotal >= 100 ? 0.0 : 5.0;
      expectedTotalAmount = Number((expectedSubtotal + expectedShippingFee).toFixed(2));

      const payload = {
        shipping_address: {
          recipient_name: 'Tariqul Islam',
          phone: '+8801711998877',
          street_address: 'House 42, Road 11, Block D',
          area: 'Banani',
          city: 'Dhaka',
          postal_code: '1213',
          country: 'Bangladesh',
        },
        payment_method: 'cash_on_delivery',
        notes: 'Full MVP E2E verification test order',
      };

      const res = await client.post('/api/v1/orders', payload, { token: customerToken });

      assert.equal(res.status, 201, `Expected 201 Created on checkout, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data, 'Order data must not be empty');

      const order = res.body.data;
      assert.ok(order.id > 0, 'Order ID must be positive integer');
      assert.ok(typeof order.order_number === 'string', 'Order number must be string');
      assert.ok(order.order_number.startsWith('ECO-'), 'Order number should start with ECO-');
      assert.equal(order.status, 'pending');
      assert.equal(order.payment_status, 'unpaid');
      assert.equal(order.payment_method, 'cash_on_delivery');
      assert.equal(Number(order.subtotal), expectedSubtotal);
      assert.equal(Number(order.shipping_fee), expectedShippingFee);
      assert.equal(Number(order.total_amount), expectedTotalAmount);

      // Verify order items snapshot
      assert.ok(Array.isArray(order.items), 'Order items must be an array');
      assert.equal(order.items.length, 1);
      const itemSnapshot = order.items[0];
      assert.equal(itemSnapshot.variant_sku, targetVariantSku);
      assert.equal(Number(itemSnapshot.unit_price), targetVariantPrice);
      assert.equal(Number(itemSnapshot.quantity), 3);
      assert.equal(itemSnapshot.variant_size || itemSnapshot.size, targetVariantSize);
      assert.equal(itemSnapshot.variant_color || itemSnapshot.color, targetVariantColor);

      createdOrderId = order.id;
      createdOrderNumber = order.order_number;
    });

    it('1.7 Atomic Database Invariant Verification: direct MySQL cross-table check', async () => {
      // 1. Verify orders table row
      const [orderRows] = await dbConn.query('SELECT * FROM orders WHERE id = ?', [createdOrderId]);
      assert.equal(orderRows.length, 1, 'Order row must exist in database');
      const dbOrder = orderRows[0];
      assert.equal(dbOrder.order_number, createdOrderNumber);
      assert.equal(dbOrder.status, 'pending');
      assert.equal(dbOrder.payment_status, 'unpaid');
      assert.equal(dbOrder.user_id, customerAId);
      assert.equal(dbOrder.payment_method, 'cash_on_delivery');
      assert.equal(Number(dbOrder.total_amount), expectedTotalAmount);

      // 2. Verify order_items snapshot row
      const [itemRows] = await dbConn.query('SELECT * FROM order_items WHERE order_id = ?', [createdOrderId]);
      assert.equal(itemRows.length, 1, 'Exact 1 order item row must exist');
      const dbItem = itemRows[0];
      assert.equal(dbItem.variant_id, targetVariantId);
      assert.equal(dbItem.variant_sku, targetVariantSku);
      assert.equal(dbItem.variant_size, targetVariantSize);
      assert.equal(dbItem.variant_color, targetVariantColor);
      assert.equal(Number(dbItem.unit_price), targetVariantPrice);
      assert.equal(Number(dbItem.quantity), 3);
      assert.equal(Number(dbItem.line_total), Number((targetVariantPrice * 3).toFixed(2)));

      // 3. Verify product_variants stock decremented by exact purchased amount (3)
      const [variantRows] = await dbConn.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [targetVariantId]);
      assert.equal(variantRows.length, 1);
      const currentStock = Number(variantRows[0].stock_quantity);
      assert.equal(
        currentStock,
        initialStock - 3,
        `Variant stock must be decremented from ${initialStock} to ${initialStock - 3}, found ${currentStock}`
      );

      // 4. Verify inventory_movements record created with reason = 'order_placed'
      const [movementRows] = await dbConn.query(
        'SELECT * FROM inventory_movements WHERE reference_order_id = ? AND variant_id = ?',
        [createdOrderId, targetVariantId]
      );
      assert.ok(movementRows.length >= 1, 'Inventory movement record must exist for the order');
      const movement = movementRows[0];
      assert.equal(movement.reason, 'order_placed');
      assert.equal(Number(movement.quantity_delta), -3);
      assert.equal(Number(movement.before_quantity), initialStock);
      assert.equal(Number(movement.after_quantity), initialStock - 3);
      assert.equal(movement.actor_id, customerAId);

      // 5. Verify cart is cleared atomically
      const [cartRows] = await dbConn.query('SELECT COUNT(*) AS cnt FROM cart_items WHERE user_id = ?', [customerAId]);
      assert.equal(cartRows[0].cnt, 0, 'Customer cart must be completely cleared after successful order placement');

      // 6. Verify payments record
      const [paymentRows] = await dbConn.query('SELECT * FROM payments WHERE order_id = ?', [createdOrderId]);
      assert.ok(paymentRows.length >= 1, 'Payment record must be created');
      const payment = paymentRows[0];
      assert.equal(payment.provider, 'cod');
      assert.equal(payment.status, 'pending');
      assert.equal(Number(payment.amount), expectedTotalAmount);

      // 7. Verify order_status_history initial record
      const [historyRows] = await dbConn.query(
        'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
        [createdOrderId]
      );
      assert.ok(historyRows.length >= 1, 'Status history record must exist');
      assert.equal(historyRows[0].previous_status, null);
      assert.equal(historyRows[0].new_status, 'pending');
    });

    it('1.8 Customer Order History: verify order listing and public tracking', async () => {
      // 1. Customer order listing
      const historyRes = await client.get('/api/v1/orders', { token: customerToken });
      assert.equal(historyRes.status, 200);
      assert.equal(historyRes.body.success, true);
      assert.ok(Array.isArray(historyRes.body.data), 'Customer orders must be an array');
      const matchedOrder = historyRes.body.data.find((o) => o.id === createdOrderId);
      assert.ok(matchedOrder, 'Placed order must appear in customer order history');
      assert.equal(matchedOrder.order_number, createdOrderNumber);
      assert.equal(matchedOrder.status, 'pending');
      assert.equal(Number(matchedOrder.total_amount), expectedTotalAmount);

      // 2. Customer order detail lookup
      const detailRes = await client.get(`/api/v1/orders/${createdOrderId}`, { token: customerToken });
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.success, true);
      assert.equal(detailRes.body.data.id, createdOrderId);
      assert.equal(detailRes.body.data.order_number, createdOrderNumber);
      assert.equal(detailRes.body.data.shipping_address.city, 'Dhaka');
      assert.ok(Array.isArray(detailRes.body.data.items), 'Order detail items must be array');
      assert.equal(detailRes.body.data.items.length, 1);

      // 3. Public guest order tracking by order number
      const trackRes = await client.get(`/api/v1/orders/track/${createdOrderNumber}`);
      assert.equal(trackRes.status, 200);
      assert.equal(trackRes.body.success, true);
      assert.equal(trackRes.body.data.order_number, createdOrderNumber);
      assert.equal(trackRes.body.data.status, 'pending');
    });

  });

  // ============================================================================
  // PART 2: ADMIN ORDER MANAGEMENT FLOW
  // ============================================================================
  describe('Part 2: Admin Order Management Flow', () => {

    it('2.1 Admin authentication: login with admin@projecteco.com and retrieve admin JWT', async () => {
      const res = await client.post('/api/v1/auth/login', {
        email: adminEmail,
        password: adminPassword,
      });

      assert.equal(res.status, 200, `Expected 200 OK on admin login, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token, 'Admin JWT token must be returned');
      assert.equal(res.body.data.user.role, 'admin', 'User role must be admin');
      adminToken = res.body.data.token;
    });

    it('2.2 Admin order listing: locate customer order in administrative list', async () => {
      const res = await client.get('/api/v1/admin/orders', { token: adminToken });

      assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Admin orders must be an array');

      const foundOrder = res.body.data.find((o) => o.id === createdOrderId);
      assert.ok(foundOrder, 'Placed order must appear in admin orders list');
      assert.equal(foundOrder.order_number, createdOrderNumber);
      assert.equal(foundOrder.status, 'pending');
      assert.equal(Number(foundOrder.total_amount), expectedTotalAmount);
    });

    it('2.3 Order status progression: pending -> confirmed -> shipped -> delivered with auto-payment marking', async () => {
      // 2.3a Transition: pending -> confirmed
      const confirmRes = await client.put(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        { status: 'confirmed', note: 'Customer verified order via telephone confirmation' },
        { token: adminToken }
      );

      assert.equal(confirmRes.status, 200, `Expected 200 OK on confirm, got ${confirmRes.status}`);
      assert.equal(confirmRes.body.success, true);
      assert.equal(confirmRes.body.data.status, 'confirmed');

      // Verify status history row in DB
      const [histConfirm] = await dbConn.query(
        'SELECT * FROM order_status_history WHERE order_id = ? AND new_status = "confirmed"',
        [createdOrderId]
      );
      assert.equal(histConfirm.length, 1);
      assert.equal(histConfirm[0].previous_status, 'pending');

      // 2.3b Transition: confirmed -> shipped
      const shipRes = await client.put(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        {
          status: 'shipped',
          courier_name: 'Steadfast Courier',
          tracking_number: 'ST-99887711',
          note: 'Consignment handed to courier representative',
        },
        { token: adminToken }
      );

      assert.equal(shipRes.status, 200, `Expected 200 OK on shipped, got ${shipRes.status}`);
      assert.equal(shipRes.body.success, true);
      assert.equal(shipRes.body.data.status, 'shipped');
      assert.equal(shipRes.body.data.courier_name, 'Steadfast Courier');
      assert.equal(shipRes.body.data.tracking_number, 'ST-99887711');

      // 2.3c Transition: shipped -> delivered (Verifies auto-marking payment_status to 'paid' for COD)
      const deliverRes = await client.put(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        { status: 'delivered', note: 'Customer received package and paid cash to delivery agent' },
        { token: adminToken }
      );

      assert.equal(deliverRes.status, 200, `Expected 200 OK on delivered, got ${deliverRes.status}`);
      assert.equal(deliverRes.body.success, true);
      assert.equal(deliverRes.body.data.status, 'delivered');
      // Crucial verification: COD order payment status automatically set to paid upon delivery
      assert.equal(
        deliverRes.body.data.payment_status,
        'paid',
        'COD order delivered status must auto-mark payment_status to paid'
      );

      // Verify DB payments table updated to succeeded
      const [payRows] = await dbConn.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [createdOrderId]);
      assert.equal(payRows[0].status, 'succeeded');
      assert.ok(payRows[0].paid_at !== null, 'Payment paid_at must be populated');

      // 2.3d Terminal State Defense: cannot transition from terminal 'delivered' status
      const invalidRes = await client.put(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        { status: 'cancelled' },
        { token: adminToken }
      );
      assert.equal(invalidRes.status, 400, 'Expected 400 Bad Request on invalid transition from delivered');
      assert.equal(invalidRes.body.success, false);
      assert.ok(
        invalidRes.body.message.toLowerCase().includes('invalid status transition'),
        'Message must explain invalid state transition'
      );
    });

    it('2.4 Variant inventory tracking & manual stock adjustment with audit trail', async () => {
      // 2.4a Admin variant inventory view
      const invRes = await client.get('/api/v1/admin/inventory', {
        query: { search: targetVariantSku },
        token: adminToken,
      });

      assert.equal(invRes.status, 200, `Expected 200 OK on admin inventory, got ${invRes.status}`);
      assert.equal(invRes.body.success, true);
      assert.ok(Array.isArray(invRes.body.data), 'Inventory data must be an array');
      const variantRecord = invRes.body.data.find((v) => v.id === targetVariantId || v.sku === targetVariantSku);
      assert.ok(variantRecord, 'Target variant must be present in inventory list');
      assert.equal(Number(variantRecord.stock_quantity), initialStock - 3);

      // 2.4b Perform manual stock adjustment (+5 restock)
      const stockBeforeAdjust = initialStock - 3;
      const adjustRes = await client.post(
        '/api/v1/admin/inventory/adjust',
        {
          variant_id: targetVariantId,
          quantity_delta: 5,
          reason: 'restock',
          note: 'E2E test warehouse inbound batch #881',
        },
        { token: adminToken }
      );

      assert.equal(adjustRes.status, 200, `Expected 200 OK on stock adjust, got ${adjustRes.status}: ${JSON.stringify(adjustRes.body)}`);
      assert.equal(adjustRes.body.success, true);
      assert.equal(Number(adjustRes.body.data.beforeQty), stockBeforeAdjust);
      assert.equal(Number(adjustRes.body.data.afterQty), stockBeforeAdjust + 5);
      assert.equal(Number(adjustRes.body.data.delta), 5);

      // 2.4c Verify inventory movement audit trail
      const movementRes = await client.get('/api/v1/admin/inventory/movements', {
        query: { variantId: targetVariantId },
        token: adminToken,
      });

      assert.equal(movementRes.status, 200);
      assert.equal(movementRes.body.success, true);
      assert.ok(Array.isArray(movementRes.body.data), 'Inventory movements must be an array');
      const manualMovement = movementRes.body.data.find(
        (m) => m.reason === 'restock' && Number(m.quantity_delta) === 5
      );
      assert.ok(manualMovement, 'Audit movement record for manual restock must exist');
      assert.equal(manualMovement.note, 'E2E test warehouse inbound batch #881');
      assert.equal(Number(manualMovement.before_quantity), stockBeforeAdjust);
      assert.equal(Number(manualMovement.after_quantity), stockBeforeAdjust + 5);

      // 2.4d Restore stock state for suite cleanliness
      await client.post(
        '/api/v1/admin/inventory/adjust',
        {
          variant_id: targetVariantId,
          quantity_delta: -2, // (-5 adjustment + 3 purchased) = -2 net delta to restore exactly to initialStock
          reason: 'manual_adjustment',
          note: 'E2E teardown cleanup restore',
        },
        { token: adminToken }
      );
    });

    it('2.5 Security & Access Control: verify 401 unauthenticated and 403 forbidden gates', async () => {
      // 2.5a Unauthenticated requests to administrative endpoints return 401 Unauthorized
      const unauthOrders = await client.get('/api/v1/admin/orders');
      assert.equal(unauthOrders.status, 401, 'Unauthenticated GET /api/v1/admin/orders must return 401');
      assert.equal(unauthOrders.body.success, false);

      const unauthInv = await client.get('/api/v1/admin/inventory');
      assert.equal(unauthInv.status, 401, 'Unauthenticated GET /api/v1/admin/inventory must return 401');
      assert.equal(unauthInv.body.success, false);

      const unauthAdjust = await client.post('/api/v1/admin/inventory/adjust', {
        variant_id: targetVariantId,
        quantity_delta: 1,
        note: 'Unauthorized attempt',
      });
      assert.equal(unauthAdjust.status, 401, 'Unauthenticated POST /api/v1/admin/inventory/adjust must return 401');
      assert.equal(unauthAdjust.body.success, false);

      // 2.5b Customer token on administrative endpoints returns 403 Forbidden
      const custAdminOrders = await client.get('/api/v1/admin/orders', { token: customerToken });
      assert.equal(custAdminOrders.status, 403, 'Customer token on GET /api/v1/admin/orders must return 403 Forbidden');
      assert.equal(custAdminOrders.body.success, false);

      const custAdminStatus = await client.put(
        `/api/v1/admin/orders/${createdOrderId}/status`,
        { status: 'shipped' },
        { token: customerToken }
      );
      assert.equal(custAdminStatus.status, 403, 'Customer token on PUT /api/v1/admin/orders/:id/status must return 403 Forbidden');
      assert.equal(custAdminStatus.body.success, false);

      const custAdminAdjust = await client.post(
        '/api/v1/admin/inventory/adjust',
        { variant_id: targetVariantId, quantity_delta: 1, note: 'Tamper' },
        { token: customerToken }
      );
      assert.equal(custAdminAdjust.status, 403, 'Customer token on POST /api/v1/admin/inventory/adjust must return 403 Forbidden');
      assert.equal(custAdminAdjust.body.success, false);

      // 2.5c Cross-customer order privacy protection: Customer B requesting Customer A\'s order returns 403
      const crossOrderRes = await client.get(`/api/v1/orders/${createdOrderId}`, { token: customerBToken });
      assert.equal(crossOrderRes.status, 403, 'Customer B accessing Customer A order must return 403 Forbidden');
      assert.equal(crossOrderRes.body.success, false);
      assert.ok(
        crossOrderRes.body.message.toLowerCase().includes('access denied'),
        'Message must state access denied'
      );
    });

  });
});
