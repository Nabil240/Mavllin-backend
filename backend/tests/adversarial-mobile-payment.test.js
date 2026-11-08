const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Adversarial Mobile Payment API Stress Tests', () => {
  let adminToken;
  let customerToken;
  let testUserId;
  let testProductId;
  let testVariantId;
  const createdOrderIds = [];
  const ts = Date.now();
  const testSku = `ADV-MFS-${ts}`;

  before(async () => {
    adminToken = getAdminToken();

    // Create test customer user
    const [u] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Adversary Customer ${ts}`, `adv-cust-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserId = u.insertId;
    customerToken = getCustomerToken({ id: testUserId, email: `adv-cust-${ts}@mavllin.test` });

    // Create test product with sufficient variant stock
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Adversarial Panjabi ${ts}`,
        short_description: 'Stress testing product',
        base_price: 2500.0,
        is_active: 1,
        variants: [
          {
            sku: testSku,
            size: 'XL',
            color: 'Obsidian',
            price: 2500.0,
            stock_quantity: 500,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201, `Failed to setup test product: ${JSON.stringify(prodRes.body)}`);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;
  });

  after(async () => {
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  async function createOrder(payload) {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shipping_address: {
          recipient_name: 'Adversary Tester',
          phone: '+8801711999888',
          street_address: 'Banani Road 11',
          city: 'Dhaka',
          postal_code: '1213',
        },
        items: [{ variant_id: testVariantId, quantity: 1 }],
        ...payload,
      });

    if (res.body && res.body.data && res.body.data.id) {
      createdOrderIds.push(res.body.data.id);
    }
    return res;
  }

  async function createGuestOrder(payload) {
    const res = await request(app)
      .post('/api/v1/orders/guest')
      .send({
        guest_email: `guest-${Date.now()}@test.com`,
        shipping_address: {
          recipient_name: 'Guest Adversary',
          phone: '+8801711999777',
          street_address: 'Gulshan 2',
          city: 'Dhaka',
          postal_code: '1212',
        },
        items: [{ variant_id: testVariantId, quantity: 1 }],
        ...payload,
      });

    if (res.body && res.body.data && res.body.data.id) {
      createdOrderIds.push(res.body.data.id);
    }
    return res;
  }

  // =========================================================================
  // 1. Boundary & Adversarial Tests on transaction_id
  // =========================================================================
  describe('1. Boundary & Adversarial Tests on transaction_id', () => {
    it('accepts unusual characters, punctuation, and symbols without crashing', async () => {
      const unusualTrx = 'TRX!@#$%^&*()_+-=[]{}|;:,.<>?';
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: unusualTrx,
        sender_phone: '01711223344',
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.transaction_id, unusualTrx);

      // Verify in DB directly
      const [rows] = await pool.query('SELECT transaction_id FROM payments WHERE order_id = ?', [res.body.data.id]);
      assert.ok(rows[0].transaction_id.includes(unusualTrx));
    });

    it('handles unicode characters (Bangla script, Cyrillic, accented)', async () => {
      const unicodeTrx = 'বিকাশ-নগদ-১২২৯৮৭-Платёж-crème';
      const res = await createOrder({
        payment_method: 'nagad',
        transaction_id: unicodeTrx,
        sender_phone: '01811223344',
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.transaction_id, unicodeTrx);

      const [rows] = await pool.query('SELECT transaction_id FROM payments WHERE order_id = ?', [res.body.data.id]);
      assert.ok(rows[0].transaction_id.includes(unicodeTrx));
    });

    it('handles emoji characters gracefully', async () => {
      const emojiTrx = 'Bkash💸123456🔥🚀';
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: emojiTrx,
        sender_phone: '01711998877',
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.transaction_id, emojiTrx);

      const [rows] = await pool.query('SELECT transaction_id FROM payments WHERE order_id = ?', [res.body.data.id]);
      assert.ok(rows[0].transaction_id.includes(emojiTrx));
    });

    it('neutralizes SQL injection payloads without syntax errors or injection', async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE payments; --",
        "admin'--",
        "1' UNION SELECT 1, 2, 'pwned', 100, 'completed', NOW() --",
      ];

      for (const sqli of sqliPayloads) {
        const res = await createOrder({
          payment_method: 'rocket',
          transaction_id: sqli,
          sender_phone: '01911223344',
        });

        assert.strictEqual(res.statusCode, 201, `SQLi payload "${sqli}" failed with status ${res.statusCode}`);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.transaction_id, sqli);

        // Verify table still intact and value safely parameterized
        const [rows] = await pool.query('SELECT transaction_id FROM payments WHERE order_id = ?', [res.body.data.id]);
        assert.ok(rows[0].transaction_id.includes(sqli));
      }
    });

    it('handles exact 120 length transaction_id without sender phone', async () => {
      const exact120 = 'T'.repeat(120);
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: exact120,
      });

      assert.strictEqual(res.statusCode, 201, `Expected 201 for 120 chars, got ${res.statusCode}`);
      assert.strictEqual(res.body.data.transaction_id, exact120);
    });

    it('rejects with clean 422 validation error when transaction_id exceeds 120 chars (no 500 crash)', async () => {
      const longTrx = 'A'.repeat(150);
      const phone = '01711000000';
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: longTrx,
        sender_phone: phone,
      });

      // Fixed: express-validator rejects with 422 instead of unhandled 500 crash
      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(JSON.stringify(res.body).includes('must not exceed 120 characters'));
    });

    it('rejects with clean 422 validation error when transaction_id alone > 120 characters', async () => {
      const over160 = 'X'.repeat(200);
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: over160,
      });

      // Fixed: express-validator rejects with 422 instead of unhandled 500 crash
      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(JSON.stringify(res.body).includes('must not exceed 120 characters'));
    });

    it('rejects whitespace-only transaction_id when no sender_phone provided (returns 400)', async () => {
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: '    \t\n  ',
      });

      assert.strictEqual(res.statusCode, 400, `Expected 400 Bad Request, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects whitespace-only transaction_id even when sender_phone is provided (returns 400)', async () => {
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: '    \t  ',
        sender_phone: '01711223344',
      });

      // Fixed: whitespace transaction_id is rejected with 400 Bad Request
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 2. Validation & Boundary Tests on sender_phone
  // =========================================================================
  describe('2. Validation & Boundary Tests on sender_phone', () => {
    it('accepts empty sender_phone (omitted) for mobile payments when transaction_id is present', async () => {
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: 'BKS_NO_PHONE_123',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.transaction_id, 'BKS_NO_PHONE_123');
      assert.strictEqual(res.body.data.sender_phone, null);
    });

    it('accepts empty string sender_phone ("")', async () => {
      const res = await createOrder({
        payment_method: 'nagad',
        transaction_id: 'NGD_EMPTY_PHONE_123',
        sender_phone: '',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.transaction_id, 'NGD_EMPTY_PHONE_123');
      assert.strictEqual(res.body.data.sender_phone, null);
    });

    it('handles various phone number formats and country codes', async () => {
      const testPhones = [
        '01711000000',          // Standard BD local
        '+8801711000000',       // Standard BD international
        '8801711000000',        // BD international without plus
        '+14155552671',         // US international
        '+442071838750',        // UK international
      ];

      for (const phone of testPhones) {
        const res = await createOrder({
          payment_method: 'rocket',
          transaction_id: `ROK_${Date.now()}`,
          sender_phone: phone,
        });

        assert.strictEqual(res.statusCode, 201, `Phone ${phone} failed with status ${res.statusCode}`);
        assert.strictEqual(res.body.data.sender_phone, phone);
      }
    });

    it('correctly handles parentheses in sender_phone in extractPaymentMeta', async () => {
      const parenPhone = '+880 (171) 1000000';
      const res = await createOrder({
        payment_method: 'upay',
        transaction_id: 'UPY_PAREN_TEST',
        sender_phone: parenPhone,
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.sender_phone, parenPhone);
      assert.strictEqual(res.body.data.transaction_id, 'UPY_PAREN_TEST');
    });
  });

  // =========================================================================
  // 3. Rapid Status Transitions & paid_at Integrity
  // =========================================================================
  describe('3. Rapid Status Transitions & paid_at Integrity', () => {
    it('flips unpaid -> paid -> unpaid -> paid and validates paid_at transitions', async () => {
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: 'BKS_FLIP_TEST_1',
        sender_phone: '01711001122',
      });
      assert.strictEqual(res.statusCode, 201);
      const orderId = res.body.data.id;

      // 1. Initial State: unpaid, pending, paid_at NULL
      let [p] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(p[0].status, 'pending');
      assert.strictEqual(p[0].paid_at, null);

      // 2. Mark Paid
      const markPaid1 = await request(app)
        .put(`/api/v1/orders/${orderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });
      assert.strictEqual(markPaid1.statusCode, 200);

      [p] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(p[0].status, 'completed');
      assert.ok(p[0].paid_at, 'paid_at must be populated when marked paid');

      // 3. Mark Unpaid
      const markUnpaid = await request(app)
        .put(`/api/v1/orders/${orderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'unpaid' });
      assert.strictEqual(markUnpaid.statusCode, 200);

      [p] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(p[0].status, 'pending');
      assert.strictEqual(p[0].paid_at, null, 'paid_at must be reset to NULL when reverted to unpaid');

      // 4. Mark Paid again
      const markPaid2 = await request(app)
        .put(`/api/v1/orders/${orderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'paid' });
      assert.strictEqual(markPaid2.statusCode, 200);

      [p] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(p[0].status, 'completed');
      assert.ok(p[0].paid_at, 'paid_at must be set again');
    });

    it('performs rapid cycling of status transitions without deadlock or corruption', async () => {
      const res = await createOrder({
        payment_method: 'nagad',
        transaction_id: 'NGD_RAPID_CYCLE',
        sender_phone: '01811001122',
      });
      assert.strictEqual(res.statusCode, 201);
      const orderId = res.body.data.id;

      const sequence = ['paid', 'unpaid', 'paid', 'unpaid', 'paid'];
      for (const targetStatus of sequence) {
        const updateRes = await request(app)
          .put(`/api/v1/orders/${orderId}/payment-status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ payment_status: targetStatus });

        assert.strictEqual(updateRes.statusCode, 200);
        assert.strictEqual(updateRes.body.data.payment_status, targetStatus);
      }

      const [p] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(p[0].status, 'completed');
      assert.ok(p[0].paid_at);
    });
  });

  // =========================================================================
  // 4. Concurrent Payment Confirmation Requests
  // =========================================================================
  describe('4. Concurrent Payment Confirmation Requests on Same Order', () => {
    it('handles 10 simultaneous admin payment confirmations without deadlocks or corruption', async () => {
      const res = await createOrder({
        payment_method: 'rocket',
        transaction_id: 'ROK_CONCURRENCY_1',
        sender_phone: '01911001122',
      });
      assert.strictEqual(res.statusCode, 201);
      const orderId = res.body.data.id;

      // Fire 10 simultaneous requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .put(`/api/v1/orders/${orderId}/payment-status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ payment_status: 'paid' })
      );

      const results = await Promise.all(promises);

      // Verify all succeeded
      for (const r of results) {
        assert.strictEqual(r.statusCode, 200, `Expected 200, got ${r.statusCode}: ${JSON.stringify(r.body)}`);
        assert.strictEqual(r.body.success, true);
        assert.strictEqual(r.body.data.payment_status, 'paid');
      }

      // Verify final state in database
      const [orderRows] = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(orderRows[0].payment_status, 'paid');

      const [payRows] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(payRows.length, 1, 'There must be exactly one payment record');
      assert.strictEqual(payRows[0].status, 'completed');
      assert.ok(payRows[0].paid_at);
    });

    it('handles conflicting concurrent updates (paid vs unpaid) without crashing or deadlocking', async () => {
      const res = await createOrder({
        payment_method: 'upay',
        transaction_id: 'UPY_RACE_TEST',
        sender_phone: '01611001122',
      });
      assert.strictEqual(res.statusCode, 201);
      const orderId = res.body.data.id;

      // Interleave 5 paid and 5 unpaid simultaneously
      const promises = Array.from({ length: 10 }, (_, i) => {
        const target = i % 2 === 0 ? 'paid' : 'unpaid';
        return request(app)
          .put(`/api/v1/orders/${orderId}/payment-status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ payment_status: target });
      });

      const results = await Promise.all(promises);

      // All must return 200 (no crash or 500 error)
      for (const r of results) {
        assert.strictEqual(r.statusCode, 200, `Concurrent race request failed with status ${r.statusCode}`);
      }

      // Final state must be internally consistent
      const [orderRows] = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [orderId]);
      const [payRows] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);

      if (orderRows[0].payment_status === 'paid') {
        assert.strictEqual(payRows[0].status, 'completed');
        assert.ok(payRows[0].paid_at);
      } else {
        assert.strictEqual(payRows[0].status, 'pending');
        assert.strictEqual(payRows[0].paid_at, null);
      }
    });
  });

  // =========================================================================
  // 5. Non-Admin Attempts to Confirm Payment (Authorization & RBAC)
  // =========================================================================
  describe('5. Non-Admin Attempts to Confirm Payment', () => {
    let targetOrderId;

    before(async () => {
      const res = await createOrder({
        payment_method: 'bkash',
        transaction_id: 'BKS_RBAC_TEST',
        sender_phone: '01711888999',
      });
      assert.strictEqual(res.statusCode, 201);
      targetOrderId = res.body.data.id;
    });

    it('rejects unauthenticated request to /api/v1/orders/:id/payment-status with 401', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${targetOrderId}/payment-status`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects regular customer role with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${targetOrderId}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects forged/tampered token with 401 Unauthorized', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${targetOrderId}/payment-status`)
        .set('Authorization', 'Bearer invalid.token.signature')
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects customer role on admin route alias /api/v1/admin/orders/:id/payment-status with 403', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${targetOrderId}/payment-status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects unauthenticated request on admin route alias with 401', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${targetOrderId}/payment-status`)
        .send({ payment_status: 'paid' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 6. Provider Aliases & Case-Insensitivity
  // =========================================================================
  describe('6. Provider Aliases & Case-Insensitivity', () => {
    it('normalizes lowercase "nogod" alias to "nagad"', async () => {
      const res = await createOrder({
        payment_method: 'nogod',
        transaction_id: 'NGD_ALIAS_1',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.payment_provider, 'nagad');
      assert.strictEqual(res.body.data.payment_method, 'nagad');
    });

    it('normalizes lowercase "upai" alias to "upay"', async () => {
      const res = await createOrder({
        payment_method: 'upai',
        transaction_id: 'UPY_ALIAS_1',
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.payment_provider, 'upay');
      assert.strictEqual(res.body.data.payment_method, 'upay');
    });

    it('normalizes "cash_on_delivery" and "cod" aliases', async () => {
      const res1 = await createOrder({
        payment_method: 'cash_on_delivery',
      });
      assert.strictEqual(res1.statusCode, 201);
      assert.strictEqual(res1.body.data.payment_provider, 'cod');
      assert.strictEqual(res1.body.data.payment_method, 'cash_on_delivery');

      const res2 = await createOrder({
        payment_method: 'cod',
      });
      assert.strictEqual(res2.statusCode, 201);
      assert.strictEqual(res2.body.data.payment_provider, 'cod');
      assert.strictEqual(res2.body.data.payment_method, 'cash_on_delivery');
    });

    it('normalizes uppercase and capitalized aliases ("NOGOD", "Upai", "BKASH") with 201 Created', async () => {
      const resUpper = await createOrder({
        payment_method: 'NOGOD',
        transaction_id: 'UPPER_NOGOD_1',
      });

      assert.strictEqual(resUpper.statusCode, 201);
      assert.strictEqual(resUpper.body.success, true);
      assert.strictEqual(resUpper.body.data.payment_provider, 'nagad');

      const resGuestUpper = await createGuestOrder({
        payment_method: 'BKASH',
        transaction_id: 'UPPER_BKASH_1',
      });

      assert.strictEqual(resGuestUpper.statusCode, 201);
      assert.strictEqual(resGuestUpper.body.success, true);
      assert.strictEqual(resGuestUpper.body.data.payment_provider, 'bkash');
    });
  });
});
