const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone 1: Manual Mobile Payment Checkout & Admin Confirmation APIs', () => {
  let adminToken;
  let customerToken;
  let customer2Token;
  let testUserId;
  let otherUserId;
  let testProductId;
  let testVariantId;
  const createdOrderIds = [];
  const ts = Date.now();
  const testSku = `MFS-TEST-${ts}`;

  before(async () => {
    adminToken = getAdminToken();

    // 1. Create primary test customer user
    const [u1] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`MFS Customer ${ts}`, `mfs-cust-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserId = u1.insertId;
    customerToken = getCustomerToken({ id: testUserId, email: `mfs-cust-${ts}@mavllin.test` });

    // 2. Create isolated secondary customer user for tenant authorization checks
    const [u2] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`MFS Other ${ts}`, `mfs-other-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    otherUserId = u2.insertId;
    customer2Token = getCustomerToken({ id: otherUserId, email: `mfs-other-${ts}@mavllin.test` });

    // 3. Create test product with sufficient variant stock
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `MFS Payment Panjabi ${ts}`,
        short_description: 'Pure cotton panjabi for automated mobile payment testing',
        base_price: 2800.0,
        is_active: 1,
        variants: [
          {
            sku: testSku,
            size: 'L',
            color: 'Charcoal Grey',
            price: 2800.0,
            compare_at_price: 3500.0,
            stock_quantity: 50,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201, `Failed to setup test product: ${JSON.stringify(prodRes.body)}`);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;
  });

  after(async () => {
    // 1. Clean up created orders (cascades to payments, order_items, status_history)
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }

    // 2. Clean up test users (orders must be deleted first due to ON DELETE RESTRICT)
    if (testUserId || otherUserId) {
      await pool.query('DELETE FROM users WHERE id IN (?, ?)', [testUserId || 0, otherUserId || 0]);
    }

    // 3. Clean up test product
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  // =========================================================================
  // 1. bKash Mobile Payment Order Placement
  // =========================================================================
  describe('1. bKash Mobile Payment Order Placement', () => {
    it('places order with bKash TrxID and sender phone -> payment_status is unpaid, payment record is pending', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS9928174A',
          sender_phone: '01711000001',
          shipping_address: {
            recipient_name: 'bKash Buyer',
            phone: '+8801711000001',
            street_address: 'House 12, Road 4, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'bkash');
      assert.strictEqual(order.payment_status, 'unpaid');
      assert.strictEqual(order.status, 'pending');

      // Verify direct database persistence in payments table
      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments.length, 1);
      assert.strictEqual(payments[0].provider, 'bkash');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'BKS9928174A (From: 01711000001)');

      // Verify order response projection
      assert.strictEqual(order.payment_provider, 'bkash');
      assert.strictEqual(order.payment_transaction_id, 'BKS9928174A (From: 01711000001)');
      assert.strictEqual(order.transaction_id, 'BKS9928174A');
      assert.strictEqual(order.sender_phone, '01711000001');
      assert.strictEqual(order.payment_record_status, 'pending');
    });

    it('places guest bKash order via POST /api/v1/orders/guest', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_GUEST_123',
          sender_phone: '01711000099',
          guest_email: 'guest-bkash@mavllin.test',
          shipping_address: {
            recipient_name: 'Guest bKash Customer',
            phone: '+8801711000099',
            street_address: 'Mirpur DOHS',
            city: 'Dhaka',
            postal_code: '1216',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'bkash');
      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'bkash');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'BKS_GUEST_123 (From: 01711000099)');
    });
  });

  // =========================================================================
  // 2. Nagad Mobile Payment & Nogod Alias Resolution
  // =========================================================================
  describe('2. Nagad Mobile Payment & Nogod Alias Resolution', () => {
    it('places order with standard "nagad" provider name', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: 'NGD8823194B',
          sender_phone: '01811000002',
          shipping_address: {
            recipient_name: 'Nagad Buyer',
            phone: '+8801811000002',
            street_address: 'Banani 11',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'nagad');
      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'nagad');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'NGD8823194B (From: 01811000002)');
    });

    it('places order with "nogod" alias and normalizes provider to "nagad"', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'nogod',
          transaction_id: 'NGD3344556C',
          sender_phone: '01811000003',
          shipping_address: {
            recipient_name: 'Nogod Buyer',
            phone: '+8801811000003',
            street_address: 'Uttara Sector 7',
            city: 'Dhaka',
            postal_code: '1230',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'nagad');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'NGD3344556C (From: 01811000003)');
    });
  });

  // =========================================================================
  // 3. Rocket and Upay (including Upai alias) Order Placement
  // =========================================================================
  describe('3. Rocket and Upay (including Upai alias) Order Placement', () => {
    it('places order with "rocket" via /api/v1/checkout/orders', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'rocket',
          transaction_id: 'RKT7736291D',
          sender_phone: '01911000004',
          shipping_address: {
            recipient_name: 'Rocket Buyer',
            phone: '+8801911000004',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201, `Failed rocket checkout: ${JSON.stringify(res.body)}`);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'rocket');
      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'rocket');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'RKT7736291D (From: 01911000004)');
    });

    it('places order with "upay"', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'upay',
          transaction_id: 'UPY4455667E',
          sender_phone: '01611000005',
          shipping_address: {
            recipient_name: 'Upay Buyer',
            phone: '+8801611000005',
            street_address: 'Mohakhali DOHS',
            city: 'Dhaka',
            postal_code: '1206',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'upay');
      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'upay');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'UPY4455667E (From: 01611000005)');
    });

    it('places order with "upai" alias and normalizes provider to "upay"', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'upai',
          transaction_id: 'UPY9988776F',
          sender_phone: '01611000006',
          shipping_address: {
            recipient_name: 'Upai Alias Buyer',
            phone: '+8801611000006',
            street_address: 'Bashundhara R/A',
            city: 'Dhaka',
            postal_code: '1229',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'upay');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, 'UPY9988776F (From: 01611000006)');
    });
  });

  // =========================================================================
  // 4. Cash on Delivery (COD) Baseline Comparison
  // =========================================================================
  describe('4. Cash on Delivery (COD) Baseline Comparison', () => {
    it('places COD order without requiring transaction_id -> payment_status is unpaid, payment record is pending', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'cash_on_delivery',
          shipping_address: {
            recipient_name: 'COD Buyer',
            phone: '+8801711000007',
            street_address: 'Mirpur 10',
            city: 'Dhaka',
            postal_code: '1216',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_method, 'cash_on_delivery');
      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'cod');
      assert.strictEqual(payments[0].status, 'pending');
      assert.strictEqual(payments[0].transaction_id, null);
    });

    it('places COD order with "cod" alias successfully', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'cod',
          shipping_address: {
            recipient_name: 'COD Alias Buyer',
            phone: '+8801711000008',
            street_address: 'Farmgate',
            city: 'Dhaka',
            postal_code: '1215',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.payment_status, 'unpaid');

      const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
      assert.strictEqual(payments[0].provider, 'cod');
      assert.strictEqual(payments[0].status, 'pending');
    });
  });

  // =========================================================================
  // 5. Validation Errors on Mobile Payments
  // =========================================================================
  describe('5. Validation Errors on Mobile Payments', () => {
    it('rejects bKash order when transaction_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'bkash',
          // transaction_id omitted intentionally
          sender_phone: '01711000001',
          shipping_address: {
            recipient_name: 'Invalid bKash',
            phone: '+8801711000001',
            street_address: 'Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
      assert.match(JSON.stringify(res.body).toLowerCase(), /transaction.*id/);
    });

    it('rejects rocket order when transaction_id is an empty string', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'rocket',
          transaction_id: '',
          shipping_address: {
            recipient_name: 'Empty TrxID',
            phone: '+8801911000004',
            street_address: 'Banani',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects upay order when transaction_id contains only whitespace', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'upay',
          transaction_id: '    ',
          shipping_address: {
            recipient_name: 'Whitespace TrxID',
            phone: '+8801611000005',
            street_address: 'Gulshan',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects order with unsupported payment method', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'crypto_usdt',
          shipping_address: {
            recipient_name: 'Bad Method',
            phone: '+8801711000000',
            street_address: 'Dhaka',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 6. Admin Payment Cross-Check & Confirmation
  // =========================================================================
  describe('6. Admin Payment Cross-Check & Confirmation', () => {
    let orderToConfirmId;

    before(async () => {
      // Create a pending mobile payment order to confirm
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_CONFIRM_TEST',
          sender_phone: '01711223344',
          shipping_address: {
            recipient_name: 'Confirm Target',
            phone: '+8801711223344',
            street_address: 'Dhanmondi 32',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      orderToConfirmId = orderRes.body.data.id;
      createdOrderIds.push(orderToConfirmId);
    });

    it('admin confirms payment via PUT /api/v1/orders/:id/payment-status -> status is paid, payment is completed, paid_at is set', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderToConfirmId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 200, `Confirmation failed: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      const updatedOrder = res.body.data;

      assert.strictEqual(updatedOrder.payment_status, 'paid');

      // Verify payment object in response
      if (updatedOrder.payment) {
        assert.strictEqual(updatedOrder.payment.status, 'completed');
        assert.ok(updatedOrder.payment.paid_at, 'paid_at must be populated in payment record');
      }

      // Direct verification in MySQL database
      const [orderRows] = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [orderToConfirmId]);
      assert.strictEqual(orderRows[0].payment_status, 'paid');

      const [payRows] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderToConfirmId]);
      assert.strictEqual(payRows[0].status, 'completed');
      assert.ok(payRows[0].paid_at, 'paid_at in payments table must not be null');
    });

    it('admin confirms payment via alias PUT /api/v1/admin/orders/:id/payment-status', async () => {
      // Create another order for alias testing
      const newOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'nagad',
          transaction_id: 'NGD_ALIAS_TEST',
          sender_phone: '01811998877',
          shipping_address: {
            recipient_name: 'Alias Target',
            phone: '+8801811998877',
            street_address: 'Baridhara',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(newOrderRes.statusCode, 201);
      const aliasOrderId = newOrderRes.body.data.id;
      createdOrderIds.push(aliasOrderId);

      const res = await request(app)
        .put(`/api/v1/admin/orders/${aliasOrderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.payment_status, 'paid');

      const [payRows] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [aliasOrderId]);
      assert.strictEqual(payRows[0].status, 'completed');
      assert.ok(payRows[0].paid_at);
    });

    it('rejects unauthenticated payment status update with 401 Unauthorized', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderToConfirmId}/payment-status`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects customer role on payment status update with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderToConfirmId}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects invalid payment status values with 400 or 422', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${orderToConfirmId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'partially_paid_super' });

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 7. Public Tracking Endpoint & Customer Order Detail Retrieval
  // =========================================================================
  describe('7. Public Tracking Endpoint & Customer Order Detail Retrieval', () => {
    let trackedOrderNumber;
    let trackedOrderId;

    before(async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'bkash',
          transaction_id: 'BKS_TRACK_998877',
          sender_phone: '01711554433',
          shipping_address: {
            recipient_name: 'Tracking Customer',
            phone: '+8801711554433',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      trackedOrderId = orderRes.body.data.id;
      trackedOrderNumber = orderRes.body.data.order_number;
      createdOrderIds.push(trackedOrderId);
    });

    it('public GET /api/v1/orders/track/:orderNumber returns payment method, TrxID, sender phone, and verification status', async () => {
      const res = await request(app).get(`/api/v1/orders/track/${trackedOrderNumber}`);

      assert.strictEqual(res.statusCode, 200, `Track failed: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;

      assert.strictEqual(order.order_number, trackedOrderNumber);
      assert.strictEqual(order.payment_method, 'bkash');
      assert.strictEqual(order.payment_status, 'unpaid');

      // Verify payment details projection
      assert.ok(order.payment_transaction_id.includes('BKS_TRACK_998877'));
      assert.ok(order.payment_transaction_id.includes('01711554433'));
      assert.strictEqual(order.transaction_id, 'BKS_TRACK_998877');
      assert.strictEqual(order.sender_phone, '01711554433');
      assert.strictEqual(order.payment_record_status, 'pending');
    });

    it('customer GET /api/v1/orders/:id returns payment method and transaction details to owner', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${trackedOrderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;

      assert.strictEqual(order.id, trackedOrderId);
      assert.strictEqual(order.payment_method, 'bkash');
      assert.strictEqual(order.payment_status, 'unpaid');
      assert.ok(order.payment_transaction_id.includes('BKS_TRACK_998877'));
    });

    it('rejects different customer accessing order details (tenant isolation)', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${trackedOrderId}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      assert.strictEqual(res.statusCode >= 400 && res.statusCode < 500, true);
      assert.strictEqual(res.body.success, false);
    });

    it('customer GET /api/v1/orders/my-orders includes mobile payment details in order history', async () => {
      const res = await request(app)
        .get('/api/v1/orders/my-orders')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));

      const found = res.body.data.find((o) => o.id === trackedOrderId);
      assert.ok(found, 'Placed order must appear in customer order history');
      assert.strictEqual(found.payment_method, 'bkash');
      assert.strictEqual(found.payment_status, 'unpaid');
      assert.ok(found.payment_transaction_id.includes('BKS_TRACK_998877'));
    });
  });
});
