const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('../../backend/node_modules/supertest');
const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/db');
const { getAdminToken, getCustomerToken } = require('../../backend/tests/helpers/auth.helper');

describe('Empirical Adversarial Challenge Suite: Admin Order Management & Security Boundaries', () => {
  const ts = Date.now();
  let adminToken;
  let customerToken;
  let customer2Token;

  let testUserAId;
  let testUserBId;
  let testAdminUserId;

  let testProductId;
  let testVariantId;
  let initialVariantStock = 25;

  let orderAId;
  let orderANumber;
  let orderBId;
  let orderBNumber;
  let orderCancelId;

  before(async () => {
    // 1. Authenticate seed admin to verify live credentials and get real token
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@projecteco.com', password: 'Admin@123' });

    assert.strictEqual(adminLoginRes.statusCode, 200, `Seed admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    assert.strictEqual(adminLoginRes.body.data.user.role, 'admin');
    adminToken = adminLoginRes.body.data.token;
    testAdminUserId = adminLoginRes.body.data.user.id;

    // 2. Create isolated test customers A and B for strict isolation testing
    const [u1] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, "customer", 1)',
      [`Customer A ${ts}`, `adv_cust_a_${ts}@projecteco.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserAId = u1.insertId;

    const [u2] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, "customer", 1)',
      [`Customer B ${ts}`, `adv_cust_b_${ts}@projecteco.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserBId = u2.insertId;

    customerToken = getCustomerToken({ id: testUserAId, email: `adv_cust_a_${ts}@projecteco.test`, role: 'customer' });
    customer2Token = getCustomerToken({ id: testUserBId, email: `adv_cust_b_${ts}@projecteco.test`, role: 'customer' });

    // 3. Create isolated product with variant for order lifecycle and inventory tests
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Adversarial Admin Test Jacket ${ts}`,
        base_price: 79.99,
        is_active: 1,
        variants: [
          {
            sku: `ADV-JKT-${ts}`,
            size: 'M',
            color: 'Olive Green',
            price: 79.99,
            stock_quantity: initialVariantStock,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201, `Failed to create test product: ${JSON.stringify(prodRes.body)}`);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;
  });

  after(async () => {
    // Clean up created orders and related records
    const orderIds = [orderAId, orderBId, orderCancelId].filter(Boolean);
    if (orderIds.length > 0) {
      await pool.query('DELETE FROM payments WHERE order_id IN (?)', [orderIds]);
      await pool.query('DELETE FROM order_status_history WHERE order_id IN (?)', [orderIds]);
      await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      await pool.query('DELETE FROM inventory_movements WHERE reference_order_id IN (?)', [orderIds]);
      await pool.query('DELETE FROM orders WHERE id IN (?)', [orderIds]);
    }

    // Clean up inventory movements on testVariantId
    if (testVariantId) {
      await pool.query('DELETE FROM inventory_movements WHERE variant_id = ?', [testVariantId]);
    }

    // Delete test product
    if (testProductId) {
      await pool.query('DELETE FROM product_variants WHERE product_id = ?', [testProductId]);
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }

    // Delete test users
    const userIds = [testUserAId, testUserBId].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query('DELETE FROM cart_items WHERE user_id IN (?)', [userIds]);
      await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    }
  });

  // =========================================================================
  // SECTION 1: AUTHENTICATION VERIFICATION
  // =========================================================================
  describe('1. Authentication Verification', () => {
    it('Seed admin authentication succeeds with expected role (admin@projecteco.com / Admin@123)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@projecteco.com', password: 'Admin@123' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, 'admin@projecteco.com');
      assert.strictEqual(res.body.data.user.role, 'admin');
      assert.ok(res.body.data.token, 'Access token must be present');
    });

    it('Seed customer authentication succeeds with expected role (customer@projecteco.com / Customer@123)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@projecteco.com', password: 'Customer@123' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, 'customer@projecteco.com');
      assert.strictEqual(res.body.data.user.role, 'customer');
      assert.ok(res.body.data.token, 'Access token must be present');
    });

    it('Authentication fails with HTTP 401 on incorrect credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@projecteco.com', password: 'WrongPassword!999' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid/i);
    });
  });

  // =========================================================================
  // SECTION 2: ADMIN ORDER MANAGEMENT & LIFECYCLE PROGRESSION
  // =========================================================================
  describe('2. Admin Order Management & Lifecycle Progression', () => {
    it('Admin can retrieve administrative order list (GET /api/v1/admin/orders)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Order data must be an array');
      assert.ok(res.body.meta, 'Pagination metadata must be returned');
      assert.ok(typeof res.body.meta.total === 'number');
    });

    it('Admin order list supports status and date range filtering', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=pending&startDate=2026-01-01&endDate=2026-12-31')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('Setup: Customer A places a Cash on Delivery order', async () => {
      const orderPayload = {
        items: [{ variant_id: testVariantId, quantity: 1 }],
        shipping_address: {
          recipient_name: 'Customer A Test',
          phone: '+8801700000001',
          street_address: '123 Gulshan Avenue',
          city: 'Dhaka',
          postal_code: '1212',
          country: 'Bangladesh',
        },
        payment_method: 'cash_on_delivery',
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderPayload);

      assert.strictEqual(res.statusCode, 201, `Failed to place order: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      orderAId = res.body.data.id;
      orderANumber = res.body.data.order_number;
      assert.strictEqual(res.body.data.status, 'pending');
      assert.strictEqual(res.body.data.payment_status, 'unpaid');
    });

    it('Admin progresses order lifecycle: pending -> confirmed', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed', note: 'Order verified by admin' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'confirmed');

      // Verify in DB
      const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderAId]);
      assert.strictEqual(rows[0].status, 'confirmed');
    });

    it('Admin progresses order lifecycle: confirmed -> shipped', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'shipped',
          courier_name: 'Steadfast Courier',
          tracking_number: 'STD-12345678',
          note: 'Package handed to courier',
        });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'shipped');

      // Verify in DB
      const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderAId]);
      assert.strictEqual(rows[0].status, 'shipped');
    });

    it('Admin progresses order lifecycle: shipped -> delivered (COD auto-marks payment as paid)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered', note: 'Customer accepted delivery and paid cash' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'delivered');

      // Verify in DB: status is delivered and payment_status is paid
      const [orderRows] = await pool.query('SELECT status, payment_status FROM orders WHERE id = ?', [orderAId]);
      assert.strictEqual(orderRows[0].status, 'delivered');
      assert.strictEqual(orderRows[0].payment_status, 'paid', 'COD order delivered must auto-mark payment_status as paid');

      // Verify payments table record updated
      const [payRows] = await pool.query('SELECT status FROM payments WHERE order_id = ?', [orderAId]);
      assert.strictEqual(payRows[0].status, 'succeeded');
    });

    it('Invalid lifecycle transition from terminal state (delivered -> cancelled) is rejected with HTTP 400', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled', note: 'Attempting invalid rollback after delivery' });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid status transition/i);

      // Verify status in DB remained delivered
      const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderAId]);
      assert.strictEqual(rows[0].status, 'delivered');
    });

    it('Invalid lifecycle backwards transitions (delivered -> shipped, delivered -> pending) are rejected with HTTP 400', async () => {
      const res1 = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' });

      assert.strictEqual(res1.statusCode, 400);

      const res2 = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'pending' });

      assert.strictEqual(res2.statusCode, 400);
    });

    it('Invalid lifecycle transition from terminal state (cancelled -> confirmed) is rejected with HTTP 400', async () => {
      // Place a second order to test cancelled terminal state
      const orderPayload = {
        items: [{ variant_id: testVariantId, quantity: 1 }],
        shipping_address: {
          recipient_name: 'Customer A Test 2',
          phone: '+8801700000002',
          street_address: '456 Banani',
          city: 'Dhaka',
          postal_code: '1213',
        },
        payment_method: 'cash_on_delivery',
      };

      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderPayload);

      assert.strictEqual(createRes.statusCode, 201);
      orderCancelId = createRes.body.data.id;

      // Cancel it via admin
      const cancelRes = await request(app)
        .put(`/api/v1/admin/orders/${orderCancelId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled', note: 'Customer called to cancel' });

      assert.strictEqual(cancelRes.statusCode, 200);
      assert.strictEqual(cancelRes.body.data.status, 'cancelled');

      // Attempt illegal transition from cancelled -> confirmed
      const illegalRes = await request(app)
        .put(`/api/v1/admin/orders/${orderCancelId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      assert.strictEqual(illegalRes.statusCode, 400);
      assert.strictEqual(illegalRes.body.success, false);
      assert.match(illegalRes.body.message, /invalid status transition/i);
    });
  });

  // =========================================================================
  // SECTION 3: INVENTORY ADJUSTMENT & AUDIT LOGGING
  // =========================================================================
  describe('3. Variant Stock Adjustments & Movement Audit Trail', () => {
    it('Admin can adjust variant stock (POST /api/v1/admin/inventory/adjust) and creates inventory_movements record', async () => {
      // Fetch current stock
      const [vBefore] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      const beforeQty = vBefore[0].stock_quantity;
      const delta = 7;

      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: testVariantId,
          quantity_delta: delta,
          reason: 'restock',
          note: `Adversarial stock adjustment test ${ts}`,
        });

      assert.strictEqual(res.statusCode, 200, `Stock adjustment failed: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.beforeQty, beforeQty);
      assert.strictEqual(res.body.data.afterQty, beforeQty + delta);

      // Verify product_variants table updated
      const [vAfter] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(vAfter[0].stock_quantity, beforeQty + delta);

      // Verify inventory_movements record created
      const [movements] = await pool.query(
        'SELECT * FROM inventory_movements WHERE variant_id = ? AND note = ? ORDER BY id DESC LIMIT 1',
        [testVariantId, `Adversarial stock adjustment test ${ts}`]
      );
      assert.ok(movements.length > 0, 'Movement record must exist in database');
      assert.strictEqual(movements[0].quantity_delta, delta);
      assert.strictEqual(movements[0].before_quantity, beforeQty);
      assert.strictEqual(movements[0].after_quantity, beforeQty + delta);
      assert.strictEqual(movements[0].reason, 'restock');
      assert.strictEqual(movements[0].actor_id, testAdminUserId);

      // Revert adjustment cleanly
      const revertRes = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: testVariantId,
          quantity_delta: -delta,
          reason: 'manual_adjustment',
          note: `Adversarial test reversal ${ts}`,
        });
      assert.strictEqual(revertRes.statusCode, 200);
      assert.strictEqual(revertRes.body.data.afterQty, beforeQty);
    });

    it('Overdraw stock adjustment (negative delta > current stock) is rejected with HTTP 400', async () => {
      const [vRow] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      const currentStock = vRow[0].stock_quantity;
      const excessiveNegativeDelta = -(currentStock + 50);

      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: testVariantId,
          quantity_delta: excessiveNegativeDelta,
          reason: 'damaged',
          note: 'Attempting to drive stock negative',
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /insufficient stock/i);

      // Verify stock did not change
      const [vCheck] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(vCheck[0].stock_quantity, currentStock);
    });

    it('Stock adjustment validation rejects zero delta and missing note (HTTP 422)', async () => {
      const resZero = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: testVariantId,
          quantity_delta: 0,
          note: 'Zero delta test',
        });
      assert.strictEqual(resZero.statusCode, 422);

      const resNoNote = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: testVariantId,
          quantity_delta: 5,
          note: '',
        });
      assert.strictEqual(resNoNote.statusCode, 422);
    });

    it('Stock adjustment on non-existent variant ID returns HTTP 404', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: 99999999,
          quantity_delta: 5,
          note: 'Non existent variant test',
        });
      assert.strictEqual(res.statusCode, 404);
    });
  });

  // =========================================================================
  // SECTION 4: ADVERSARIAL SECURITY BOUNDARY PROBING & RBAC
  // =========================================================================
  describe('4. Adversarial Security Boundary Probing', () => {
    it('Unauthenticated requests to GET /api/v1/admin/orders are rejected with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/admin/orders');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required/i);
    });

    it('Unauthenticated requests to PUT /api/v1/admin/orders/:id/status are rejected with HTTP 401', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .send({ status: 'delivered' });
      assert.strictEqual(res.statusCode, 401);
    });

    it('Unauthenticated requests to POST /api/v1/admin/inventory/adjust are rejected with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .send({ variant_id: testVariantId, quantity_delta: 5, note: 'hack' });
      assert.strictEqual(res.statusCode, 401);
    });

    it('Customer token access to GET /api/v1/admin/orders is rejected with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /access denied|insufficient permissions/i);
    });

    it('Customer token access to PUT /api/v1/admin/orders/:id/status is rejected with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'delivered' });

      assert.strictEqual(res.statusCode, 403);
    });

    it('Customer token access to POST /api/v1/admin/inventory/adjust is rejected with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ variant_id: testVariantId, quantity_delta: 5, note: 'unauthorized stock' });

      assert.strictEqual(res.statusCode, 403);
    });

    it('Customer token access to GET /api/v1/admin/inventory is rejected with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/inventory')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(res.statusCode, 403);
    });

    it('Customer token access to PUT /api/v1/orders/:id/status is rejected with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderAId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'shipped' });

      assert.strictEqual(res.statusCode, 403);
    });

    it('Cross-customer order isolation: Customer B cannot view Customer A order (assert HTTP 403/404)', async () => {
      // Customer B tries to view Customer A's orderAId
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      assert.strictEqual(res.statusCode, 403, `Customer B should receive 403 when probing Customer A order: got ${res.statusCode}`);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /access denied/i);
    });

    it('Cross-customer order isolation: Customer B cannot cancel Customer A order (assert HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderAId}/cancel`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ reason: 'Malicious cancellation attempt' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /access denied/i);
    });

    it('Customer A CAN view own order (GET /api/v1/orders/:id) with HTTP 200 OK', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, orderAId);
      assert.strictEqual(res.body.data.user_id, testUserAId);
    });

    it('Admin CAN view Customer A order (GET /api/v1/orders/:id) with HTTP 200 OK', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, orderAId);
    });

    it('Unauthenticated request to GET /api/v1/orders/:id is rejected with HTTP 401', async () => {
      const res = await request(app).get(`/api/v1/orders/${orderAId}`);
      assert.strictEqual(res.statusCode, 401);
    });
  });
});
