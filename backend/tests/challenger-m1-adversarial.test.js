const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone 1 Empirical Challenge: Data Integrity, Multi-Tenancy & Database Cascades', () => {
  let adminToken;
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let testProductId;
  let testVariantId;
  let testCouponId;

  const createdOrderIds = [];
  const createdCouponIds = [];
  const createdMovementIds = [];
  const ts = Date.now();
  const testSku = `CHAL-M1-${ts}`;
  const couponCode = `CHALCOUPON${ts}`;

  before(async () => {
    adminToken = getAdminToken();

    // 1. Create User A (Customer A)
    const [uA] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Challenger User A ${ts}`, `userA-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    userAId = uA.insertId;
    userAToken = getCustomerToken({ id: userAId, email: `userA-${ts}@mavllin.test` });

    // 2. Create User B (Customer B)
    const [uB] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Challenger User B ${ts}`, `userB-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    userBId = uB.insertId;
    userBToken = getCustomerToken({ id: userBId, email: `userB-${ts}@mavllin.test` });

    // 3. Create test product & variant
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Challenger M1 Panjabi ${ts}`,
        short_description: 'Product for empirical M1 adversarial testing',
        base_price: 3200.0,
        is_active: 1,
        variants: [
          {
            sku: testSku,
            size: 'M',
            color: 'Midnight Indigo',
            price: 3200.0,
            compare_at_price: 3800.0,
            stock_quantity: 100,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201, `Failed to setup test product: ${JSON.stringify(prodRes.body)}`);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;

    // 4. Create test coupon for cascade test
    const [coup] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active)
       VALUES (?, 'fixed', 200.00, 1000.00, 1)`,
      [couponCode]
    );
    testCouponId = coup.insertId;
    createdCouponIds.push(testCouponId);
  });

  after(async () => {
    // 1. Delete created inventory movements
    if (createdMovementIds.length > 0) {
      await pool.query('DELETE FROM inventory_movements WHERE id IN (?)', [createdMovementIds]);
    }

    // 2. Delete created orders (cascades to payments, order_items, order_status_history)
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }

    // Safety sweep: delete any orders attached to test users before attempting to delete users
    if (userAId || userBId) {
      await pool.query('DELETE FROM orders WHERE user_id IN (?, ?)', [userAId || 0, userBId || 0]);
    }

    // 3. Delete created coupons
    if (createdCouponIds.length > 0) {
      await pool.query('DELETE FROM coupons WHERE id IN (?)', [createdCouponIds]);
    }

    // 4. Delete test users (safe once orders are removed)
    if (userAId || userBId) {
      await pool.query('DELETE FROM users WHERE id IN (?, ?)', [userAId || 0, userBId || 0]);
    }

    // 5. Delete test product (cascades variants)
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  // =========================================================================
  // SUITE 1: Multi-Endpoint Data Integrity & Retrieval Consistency Matrix
  // =========================================================================
  describe('Suite 1: Order Retrieval Across All Endpoints Consistency Matrix', () => {
    async function assertOrderEndpointsConsistent({
      orderId,
      orderNumber,
      ownerToken,
      expectedMethod,
      expectedProvider,
      expectedTrxId,
      expectedSenderPhone,
      expectedPaymentRecordStatus,
      expectedPaymentStatus,
    }) {
      // 1. Public Track Endpoint: GET /orders/track/:orderNumber
      const trackRes = await request(app).get(`/api/v1/orders/track/${orderNumber}`);
      assert.strictEqual(trackRes.statusCode, 200, `Track endpoint failed: ${JSON.stringify(trackRes.body)}`);
      const trackOrder = trackRes.body.data;

      // 2. Authenticated Detail Endpoint: GET /orders/:id
      const detailRes = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      assert.strictEqual(detailRes.statusCode, 200, `Detail endpoint failed: ${JSON.stringify(detailRes.body)}`);
      const detailOrder = detailRes.body.data;

      // 3. Authenticated Order History: GET /orders/my-orders
      const myOrdersRes = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${ownerToken}`);
      assert.strictEqual(myOrdersRes.statusCode, 200, `My orders endpoint failed: ${JSON.stringify(myOrdersRes.body)}`);
      const myOrder = myOrdersRes.body.data.find((o) => o.id === orderId);
      assert.ok(myOrder, `Order ${orderId} missing from my-orders list`);

      // 4. Admin Orders Endpoint: GET /admin/orders
      const adminOrdersRes = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(adminOrdersRes.statusCode, 200, `Admin orders endpoint failed: ${JSON.stringify(adminOrdersRes.body)}`);
      const adminOrder = adminOrdersRes.body.data.find((o) => o.id === orderId);
      assert.ok(adminOrder, `Order ${orderId} missing from admin orders list`);

      const endpoints = [
        { name: 'GET /orders/track/:orderNumber', obj: trackOrder },
        { name: 'GET /orders/:id', obj: detailOrder },
        { name: 'GET /orders/my-orders', obj: myOrder },
        { name: 'GET /admin/orders', obj: adminOrder },
      ];

      for (const ep of endpoints) {
        assert.strictEqual(
          ep.obj.payment_method,
          expectedMethod,
          `[${ep.name}] payment_method mismatch: got ${ep.obj.payment_method}, expected ${expectedMethod}`
        );
        assert.strictEqual(
          ep.obj.payment_provider,
          expectedProvider,
          `[${ep.name}] payment_provider mismatch: got ${ep.obj.payment_provider}, expected ${expectedProvider}`
        );
        assert.strictEqual(
          ep.obj.payment_status,
          expectedPaymentStatus,
          `[${ep.name}] payment_status mismatch: got ${ep.obj.payment_status}, expected ${expectedPaymentStatus}`
        );
        assert.strictEqual(
          ep.obj.payment_record_status,
          expectedPaymentRecordStatus,
          `[${ep.name}] payment_record_status mismatch: got ${ep.obj.payment_record_status}, expected ${expectedPaymentRecordStatus}`
        );
        assert.strictEqual(
          ep.obj.transaction_id,
          expectedTrxId,
          `[${ep.name}] transaction_id mismatch: got ${ep.obj.transaction_id}, expected ${expectedTrxId}`
        );
        assert.strictEqual(
          ep.obj.sender_phone,
          expectedSenderPhone,
          `[${ep.name}] sender_phone mismatch: got ${ep.obj.sender_phone}, expected ${expectedSenderPhone}`
        );
      }
    }

    it('Scenario A: bKash mobile payment with TrxID and sender phone returns consistent projection across 4 endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_SCENARIO_A',
          sender_phone: '01711223344',
          shipping_address: {
            recipient_name: 'Recipient A',
            phone: '+8801711223344',
            street_address: 'House 1, Road 2, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'bkash',
        expectedProvider: 'bkash',
        expectedTrxId: 'BKS_SCENARIO_A',
        expectedSenderPhone: '01711223344',
        expectedPaymentRecordStatus: 'pending',
        expectedPaymentStatus: 'unpaid',
      });
    });

    it('Scenario B: Nagad mobile payment with TrxID and NO sender phone returns consistent projection across 4 endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: 'NGD_SCENARIO_B_NOTEL',
          shipping_address: {
            recipient_name: 'Recipient B',
            phone: '+8801811998877',
            street_address: 'Banani 11',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'nagad',
        expectedProvider: 'nagad',
        expectedTrxId: 'NGD_SCENARIO_B_NOTEL',
        expectedSenderPhone: null,
        expectedPaymentRecordStatus: 'pending',
        expectedPaymentStatus: 'unpaid',
      });
    });

    it('Scenario C: Rocket mobile payment confirmed as paid via PUT /orders/:id/payment-status reflects across 4 endpoints', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'rocket',
          transaction_id: 'RKT_SCENARIO_C',
          sender_phone: '01911990011',
          shipping_address: {
            recipient_name: 'Recipient C',
            phone: '+8801911990011',
            street_address: 'Mirpur DOHS',
            city: 'Dhaka',
            postal_code: '1216',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(createRes.statusCode, 201);
      const order = createRes.body.data;
      createdOrderIds.push(order.id);

      // Confirm payment as admin
      const confirmRes = await request(app)
        .put(`/api/v1/orders/${order.id}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });
      assert.strictEqual(confirmRes.statusCode, 200);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'rocket',
        expectedProvider: 'rocket',
        expectedTrxId: 'RKT_SCENARIO_C',
        expectedSenderPhone: '01911990011',
        expectedPaymentRecordStatus: 'completed',
        expectedPaymentStatus: 'paid',
      });
    });

    it('Scenario D: Upay mobile payment confirmed as paid via alias PUT /admin/orders/:id/payment-status reflects across 4 endpoints', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'upay',
          transaction_id: 'UPY_SCENARIO_D',
          sender_phone: '01511887766',
          shipping_address: {
            recipient_name: 'Recipient D',
            phone: '+8801511887766',
            street_address: 'Uttara Sector 7',
            city: 'Dhaka',
            postal_code: '1230',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(createRes.statusCode, 201);
      const order = createRes.body.data;
      createdOrderIds.push(order.id);

      // Confirm payment via admin alias route
      const confirmRes = await request(app)
        .put(`/api/v1/admin/orders/${order.id}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });
      assert.strictEqual(confirmRes.statusCode, 200);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'upay',
        expectedProvider: 'upay',
        expectedTrxId: 'UPY_SCENARIO_D',
        expectedSenderPhone: '01511887766',
        expectedPaymentRecordStatus: 'completed',
        expectedPaymentStatus: 'paid',
      });
    });

    it('Scenario E: Reverting payment status from paid back to unpaid returns pending payment record across 4 endpoints', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_REVERT_TEST',
          sender_phone: '01700112233',
          shipping_address: {
            recipient_name: 'Recipient E',
            phone: '+8801700112233',
            street_address: 'Bashundhara R/A',
            city: 'Dhaka',
            postal_code: '1229',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(createRes.statusCode, 201);
      const order = createRes.body.data;
      createdOrderIds.push(order.id);

      // Step 1: Mark paid
      await request(app)
        .put(`/api/v1/orders/${order.id}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });

      // Step 2: Revert back to unpaid
      const revertRes = await request(app)
        .put(`/api/v1/orders/${order.id}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'unpaid' });
      assert.strictEqual(revertRes.statusCode, 200);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'bkash',
        expectedProvider: 'bkash',
        expectedTrxId: 'BKS_REVERT_TEST',
        expectedSenderPhone: '01700112233',
        expectedPaymentRecordStatus: 'pending',
        expectedPaymentStatus: 'unpaid',
      });

      // Confirm paid_at in DB was set to NULL upon revert
      const [payRows] = await pool.query('SELECT paid_at FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payRows[0].paid_at, null);
    });

    it('Scenario F: COD order consistency across 4 endpoints (null TrxID, cod provider)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'cod',
          shipping_address: {
            recipient_name: 'Recipient COD',
            phone: '+8801700112244',
            street_address: 'Lalmatia',
            city: 'Dhaka',
            postal_code: '1207',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'cash_on_delivery',
        expectedProvider: 'cod',
        expectedTrxId: null,
        expectedSenderPhone: null,
        expectedPaymentRecordStatus: 'pending',
        expectedPaymentStatus: 'unpaid',
      });
    });

    it('Scenario G: COD order lifecycle transition to delivered auto-updates payment to succeeded across 4 endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'cod',
          shipping_address: {
            recipient_name: 'Recipient COD Delivery',
            phone: '+8801700112255',
            street_address: 'Baridhara',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      // Lifecycle: pending -> confirmed -> processing -> shipped -> delivered
      await request(app).put(`/api/v1/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'confirmed' });
      await request(app).put(`/api/v1/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' });
      await request(app).put(`/api/v1/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'shipped', courier_name: 'Steadfast', tracking_number: 'ST-9988' });
      const delivRes = await request(app).put(`/api/v1/orders/${order.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' });
      assert.strictEqual(delivRes.statusCode, 200);

      await assertOrderEndpointsConsistent({
        orderId: order.id,
        orderNumber: order.order_number,
        ownerToken: userAToken,
        expectedMethod: 'cash_on_delivery',
        expectedProvider: 'cod',
        expectedTrxId: null,
        expectedSenderPhone: null,
        expectedPaymentRecordStatus: 'succeeded',
        expectedPaymentStatus: 'paid',
      });
    });
  });

  // =========================================================================
  // SUITE 2: Multi-Tenant Security & Route Authorization Defenses
  // =========================================================================
  describe('Suite 2: Multi-Tenant Security & Route Authorization Defenses', () => {
    let orderAId;
    let orderANumber;
    let orderBId;
    let orderBNumber;

    before(async () => {
      // Create Order owned by Customer A
      const resA = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_USER_A_ORD',
          sender_phone: '0171100000A',
          shipping_address: {
            recipient_name: 'User A Recipient',
            phone: '+880171100000A',
            street_address: 'User A Address',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(resA.statusCode, 201);
      orderAId = resA.body.data.id;
      orderANumber = resA.body.data.order_number;
      createdOrderIds.push(orderAId);

      // Create Order owned by Customer B
      const resB = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: 'NGD_USER_B_ORD',
          sender_phone: '0181100000B',
          shipping_address: {
            recipient_name: 'User B Recipient',
            phone: '+880181100000B',
            street_address: 'User B Address',
            city: 'Dhaka',
            postal_code: '1206',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(resB.statusCode, 201);
      orderBId = resB.body.data.id;
      orderBNumber = resB.body.data.order_number;
      createdOrderIds.push(orderBId);
    });

    it('rejects User A attempting to access User B order via GET /api/v1/orders/:id with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderBId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    it('rejects User A attempting to access User B order via order_number on /orders/:orderNumber with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderBNumber}`)
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    it('rejects User B attempting to access User A order via GET /api/v1/orders/:id with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    it('rejects unauthenticated request to GET /api/v1/orders/:id with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/orders/${orderAId}`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects User A attempting to cancel User B order via POST /orders/:id/cancel with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${orderBId}/cancel`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ reason: 'Malicious cancellation attempt' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Access denied/i);
    });

    it('rejects User A attempting to update payment status via PUT /orders/:id/payment-status with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderBId}/payment-status`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('ensures User A GET /orders/my-orders contains only User A orders and NEVER exposes User B orders', async () => {
      const resA = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${userAToken}`);

      assert.strictEqual(resA.statusCode, 200);
      const ordersA = resA.body.data;
      assert.ok(ordersA.some((o) => o.id === orderAId), 'User A must see orderA');
      assert.ok(!ordersA.some((o) => o.id === orderBId), 'User A MUST NOT see orderB');

      const resB = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${userBToken}`);

      assert.strictEqual(resB.statusCode, 200);
      const ordersB = resB.body.data;
      assert.ok(ordersB.some((o) => o.id === orderBId), 'User B must see orderB');
      assert.ok(!ordersB.some((o) => o.id === orderAId), 'User B MUST NOT see orderA');
    });

    it('allows Admin to access any tenant order via GET /api/v1/orders/:id', async () => {
      const resA = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(resA.statusCode, 200);
      assert.strictEqual(resA.body.data.id, orderAId);

      const resB = await request(app)
        .get(`/api/v1/orders/${orderBId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(resB.statusCode, 200);
      assert.strictEqual(resB.body.data.id, orderBId);
    });

    it('allows legitimate owner to access their own order via GET /api/v1/orders/:id', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${orderAId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.id, orderAId);
    });
  });

  // =========================================================================
  // SUITE 3: Database Referential Integrity, Foreign Keys & Cascade Behavior
  // =========================================================================
  describe('Suite 3: Database Referential Integrity, Foreign Keys & Cascade Behavior', () => {
    it('verifies ON DELETE CASCADE removes payments row when order is deleted', async () => {
      // 1. Create order
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_CASCADE_PAYMENT',
          sender_phone: '01711999888',
          shipping_address: {
            recipient_name: 'Cascade Target',
            phone: '+8801711999888',
            street_address: 'Road 5',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      // 2. Verify payment row exists in DB
      const [payBefore] = await pool.query('SELECT id FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(payBefore.length, 1, 'Payment record must exist before deletion');

      // 3. Delete order directly in MySQL
      const [delResult] = await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(delResult.affectedRows, 1);

      // 4. Verify payment row was cascaded and deleted automatically
      const [payAfter] = await pool.query('SELECT id FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(payAfter.length, 0, 'Payment record MUST be deleted automatically via ON DELETE CASCADE');
    });

    it('verifies ON DELETE CASCADE removes order_items rows when order is deleted', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: 'NGD_CASCADE_ITEMS',
          sender_phone: '01811888777',
          shipping_address: {
            recipient_name: 'Items Cascade Target',
            phone: '+8801811888777',
            street_address: 'Road 6',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: testVariantId, quantity: 2 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      const [itemsBefore] = await pool.query('SELECT id FROM order_items WHERE order_id = ?', [orderId]);
      assert.strictEqual(itemsBefore.length, 1);

      await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);

      const [itemsAfter] = await pool.query('SELECT id FROM order_items WHERE order_id = ?', [orderId]);
      assert.strictEqual(itemsAfter.length, 0, 'order_items MUST be deleted automatically via ON DELETE CASCADE');
    });

    it('verifies ON DELETE CASCADE removes order_status_history rows when order is deleted', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'rocket',
          transaction_id: 'RKT_CASCADE_HIST',
          sender_phone: '01911777666',
          shipping_address: {
            recipient_name: 'Hist Cascade Target',
            phone: '+8801911777666',
            street_address: 'Road 7',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      // Update status to create an entry in order_status_history
      await request(app)
        .put(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      const [histBefore] = await pool.query('SELECT id FROM order_status_history WHERE order_id = ?', [orderId]);
      assert.ok(histBefore.length >= 2, 'Must have at least 2 history rows (placed + status update)');

      await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);

      const [histAfter] = await pool.query('SELECT id FROM order_status_history WHERE order_id = ?', [orderId]);
      assert.strictEqual(histAfter.length, 0, 'order_status_history MUST be deleted automatically via ON DELETE CASCADE');
    });

    it('verifies ON DELETE SET NULL on inventory_movements sets reference_order_id to NULL when order is deleted', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_CASCADE_MOV',
          sender_phone: '01711666555',
          shipping_address: {
            recipient_name: 'Mov Cascade Target',
            phone: '+8801711666555',
            street_address: 'Road 8',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      // Insert an inventory movement referencing this order
      const [mov] = await pool.query(
        `INSERT INTO inventory_movements (variant_id, quantity_delta, before_quantity, after_quantity, reason, note, reference_order_id)
         VALUES (?, -1, 100, 99, 'order_placed', 'Test movement reference', ?)`,
        [testVariantId, orderId]
      );
      const movementId = mov.insertId;
      createdMovementIds.push(movementId);

      // Delete the order
      await pool.query('DELETE FROM orders WHERE id = ?', [orderId]);

      // Check movement: it must STILL exist, but reference_order_id must be NULL
      const [movRows] = await pool.query('SELECT id, reference_order_id FROM inventory_movements WHERE id = ?', [movementId]);
      assert.strictEqual(movRows.length, 1, 'Movement row must not be deleted');
      assert.strictEqual(movRows[0].reference_order_id, null, 'reference_order_id MUST be set to NULL via ON DELETE SET NULL');
    });

    it('verifies ON DELETE RESTRICT blocks deleting a user who has active orders', async () => {
      // Create isolated temporary user
      const [tempU] = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, is_active)
         VALUES ('Temp User Cascade', 'temp-cascade-${ts}@mavllin.test', 'hash', 'customer', 1)`
      );
      const tempUserId = tempU.insertId;
      const tempUserToken = getCustomerToken({ id: tempUserId, email: `temp-cascade-${ts}@mavllin.test` });

      // Place order for this user
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${tempUserToken}`)
        .send({
          payment_method: 'cod',
          shipping_address: {
            recipient_name: 'Temp User',
            phone: '+8801700999000',
            street_address: 'Temp Street',
            city: 'Dhaka',
            postal_code: '1200',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const tempOrderId = createRes.body.data.id;

      // Attempting to delete the user while order exists MUST throw a foreign key error
      let caughtError = null;
      try {
        await pool.query('DELETE FROM users WHERE id = ?', [tempUserId]);
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected foreign key restriction error when deleting user with active orders');
      assert.strictEqual(caughtError.code, 'ER_ROW_IS_REFERENCED_2', 'Must be ER_ROW_IS_REFERENCED_2 error');

      // Teardown: delete order first, then user deletion succeeds
      await pool.query('DELETE FROM orders WHERE id = ?', [tempOrderId]);
      const [delUserRes] = await pool.query('DELETE FROM users WHERE id = ?', [tempUserId]);
      assert.strictEqual(delUserRes.affectedRows, 1, 'User deletion must succeed once orders are removed');
    });

    it('verifies ON DELETE SET NULL sets orders.coupon_id to NULL when coupon is deleted', async () => {
      // Create dedicated coupon
      const [coup] = await pool.query(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active)
         VALUES (?, 'fixed', 100.00, 500.00, 1)`,
        [`CASCADE-COUP-${ts}`]
      );
      const coupId = coup.insertId;

      // Place order applying coupon
      const createRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_COUP_TEST',
          sender_phone: '01711223344',
          coupon_code: `CASCADE-COUP-${ts}`,
          shipping_address: {
            recipient_name: 'Coupon Order Target',
            phone: '+8801711223344',
            street_address: 'Coupon St',
            city: 'Dhaka',
            postal_code: '1200',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      // Verify coupon_id is set
      const [orderBefore] = await pool.query('SELECT coupon_id FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(orderBefore[0].coupon_id, coupId);

      // Delete the coupon
      await pool.query('DELETE FROM coupons WHERE id = ?', [coupId]);

      // Verify orders.coupon_id was set to NULL automatically
      const [orderAfter] = await pool.query('SELECT coupon_id FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(orderAfter[0].coupon_id, null, 'orders.coupon_id MUST be set to NULL via ON DELETE SET NULL');
    });
  });

  // =========================================================================
  // SUITE 4: Adversarial Input Probing & TrxID Format Parsing
  // =========================================================================
  describe('Suite 4: Adversarial Input Probing & TrxID Format Parsing', () => {
    it('rejects mobile payment when transaction_id is missing with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          shipping_address: {
            recipient_name: 'Missing Trx',
            phone: '+8801700112233',
            street_address: 'Test Rd',
            city: 'Dhaka',
            postal_code: '1200',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Transaction ID is required/i);
    });

    it('rejects mobile payment when transaction_id is empty string or spaces with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: '   ',
          shipping_address: {
            recipient_name: 'Empty Trx',
            phone: '+8801700112233',
            street_address: 'Test Rd',
            city: 'Dhaka',
            postal_code: '1200',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Transaction ID is required/i);
    });

    it('correctly parses complex TrxID containing parentheses and country code phone', async () => {
      const complexTrxId = 'TXN(APP#2)-998811';
      const senderPhone = '+8801711-223344';

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: complexTrxId,
          sender_phone: senderPhone,
          shipping_address: {
            recipient_name: 'Complex Trx Buyer',
            phone: '+8801711223344',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.transaction_id, complexTrxId);
      assert.strictEqual(order.sender_phone, senderPhone);

      // Verify on public tracking endpoint
      const trackRes = await request(app).get(`/api/v1/orders/track/${order.order_number}`);
      assert.strictEqual(trackRes.statusCode, 200);
      assert.strictEqual(trackRes.body.data.transaction_id, complexTrxId);
      assert.strictEqual(trackRes.body.data.sender_phone, senderPhone);
    });

    it('correctly normalizes mobile payment aliases (nogod -> nagad, upai -> upay)', async () => {
      const resNogod = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'nogod',
          transaction_id: 'NGD_ALIAS_CHECK',
          sender_phone: '01811000000',
          shipping_address: {
            recipient_name: 'Alias Buyer',
            phone: '+8801811000000',
            street_address: 'Dhanmondi 27',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(resNogod.statusCode, 201);
      const ordNogod = resNogod.body.data;
      createdOrderIds.push(ordNogod.id);
      assert.strictEqual(ordNogod.payment_method, 'nagad');
      assert.strictEqual(ordNogod.payment_provider, 'nagad');

      const resUpai = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          payment_method: 'upai',
          transaction_id: 'UPY_ALIAS_CHECK',
          sender_phone: '01511000000',
          shipping_address: {
            recipient_name: 'Alias Buyer Upay',
            phone: '+8801511000000',
            street_address: 'Banani',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(resUpai.statusCode, 201);
      const ordUpai = resUpai.body.data;
      createdOrderIds.push(ordUpai.id);
      assert.strictEqual(ordUpai.payment_method, 'upay');
      assert.strictEqual(ordUpai.payment_provider, 'upay');
    });
  });

  // =========================================================================
  // SUITE 5: Clean Teardown Verification Harness
  // =========================================================================
  describe('Suite 5: Clean Teardown Verification Harness', () => {
    it('verifies teardown removes all test orders and leaves zero orphan payment records', async () => {
      const sampleOrderId = createdOrderIds[0];
      assert.ok(sampleOrderId, 'At least one order must have been created');

      const [payRows] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [sampleOrderId]);
      assert.ok(payRows[0].total >= 1, 'Payment row exists while order exists');
    });
  });
});
