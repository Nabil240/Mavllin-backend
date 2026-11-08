/**
 * backend/tests/challenger-m5-coupon-auth.test.js
 * 
 * Adversarial Challenger Test Suite — Milestone 5
 * Exhaustively stress-tests backend coupon authentication enforcement,
 * guest order rejection, discount injection protection, alias routing,
 * and database invariants.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getCustomerToken } = require('./helpers/auth.helper');
const OrderModel = require('../src/models/order.model');
const CouponController = require('../src/controllers/coupon.controller');

describe('Adversarial Challenger M5: Coupon Authentication & Guest Rejection Suite', () => {
  let customerToken;
  let testProductId;
  let testVariantId;
  let testCouponId;
  const createdOrderIds = [];
  const ts = Date.now();
  const testCouponCode = `CHAL_COUP_${ts}`;

  before(async () => {
    customerToken = getCustomerToken();

    // 1. Create a dedicated test product and variant
    const [pRes] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 2500.00, 1)`,
      [`Adversarial Test Product ${ts}`, `adv-test-prod-${ts}`]
    );
    testProductId = pRes.insertId;

    const [vRes] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, 'XL', 'Black', 2500.00, 100, 1)`,
      [testProductId, `SKU-ADV-${ts}`]
    );
    testVariantId = vRes.insertId;

    // 2. Create test coupon: 15% discount, min order 2000, max usage 50
    const [cRes] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, is_active)
       VALUES (?, 'percentage', 15.00, 2000.00, 50, 1)`,
      [testCouponCode]
    );
    testCouponId = cRes.insertId;
  });

  after(async () => {
    // Delete created test orders (restoring stock)
    for (const orderId of createdOrderIds) {
      await OrderModel.delete(orderId).catch(() => {});
    }

    if (testCouponId) {
      await pool.query('DELETE FROM coupons WHERE id = ?', [testCouponId]).catch(() => {});
    }

    if (testVariantId) {
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]).catch(() => {});
    }

    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]).catch(() => {});
    }
  });

  // ============================================================================
  // SECTION 1: Perimeter Coupon Validation Route & Controller Probes
  // ============================================================================
  describe('1. Perimeter Coupon Validation (/api/v1/coupons/validate)', () => {
    it('BV-01: Rejects validation request without Authorization header with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: testCouponCode, subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required/i);
    });

    it('BV-02a: Rejects malformed Authorization header with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', 'NotBearerToken')
        .send({ code: testCouponCode, subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required|token/i);
    });

    it('BV-02b: Rejects forged/expired Bearer token with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', 'Bearer forged.jwt.token')
        .send({ code: testCouponCode, subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid or expired token/i);
    });

    it('BV-03: Controller-level guard returns 401 when invoked without req.user', async () => {
      let statusCalled = null;
      let bodySent = null;

      const mockReq = { body: { code: testCouponCode, subtotal: 3000.00 }, user: null };
      const mockRes = {
        status(s) {
          statusCalled = s;
          return this;
        },
        json(b) {
          bodySent = b;
          return this;
        },
      };

      await CouponController.validate(mockReq, mockRes);
      assert.strictEqual(statusCalled, 401);
      assert.strictEqual(bodySent.success, false);
      assert.match(bodySent.message, /authentication required/i);
    });

    it('BV-POS-01: Valid customer token successfully validates coupon with HTTP 200', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: testCouponCode, subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.code, testCouponCode);
      // 15% of 3000.00 = 450.00
      assert.strictEqual(Number(res.body.data.discount_amount), 450.00);
    });

    it('BV-EDGE-01: Case-insensitivity support for authenticated user (lowercase code)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: testCouponCode.toLowerCase(), subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(Number(res.body.data.discount_amount), 450.00);
    });

    it('BV-EDGE-02: Rejects subtotal below minimum order amount with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: testCouponCode, subtotal: 1500.00 }); // min is 2000

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /must be at least/i);
    });

    it('BV-EDGE-03: Returns HTTP 404 for non-existent coupon code for authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'GHOST_COUPON_NONEXISTENT', subtotal: 3000.00 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid coupon code/i);
    });
  });

  // ============================================================================
  // SECTION 2: Guest Order Placement Adversarial Probes (/api/v1/orders/guest)
  // ============================================================================
  describe('2. Guest Order Coupon & Discount Blocking Probes', () => {
    it('BV-04: Direct guest order with coupon_code returns HTTP 400 and creates NO order', async () => {
      const [[countBefore]] = await pool.query('SELECT COUNT(*) as count FROM orders');
      const [[coupBefore]] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [testCouponId]);

      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_attacker_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Attacker Guest',
            phone: '01711223344',
            street_address: 'Banani',
            city: 'Dhaka',
            postal_code: '1213',
          },
          coupon_code: testCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);

      // Verify DB invariants: zero orders created for attacker email, used_count unchanged
      const [attackerOrders] = await pool.query(
        'SELECT id FROM orders WHERE guest_email = ?',
        [`adv_attacker_${ts}@mavllin.test`]
      );
      assert.strictEqual(attackerOrders.length, 0);

      const [[coupAfter]] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [testCouponId]);
      assert.strictEqual(coupAfter.used_count, coupBefore.used_count);
    });

    it('BV-05: Direct guest order via alias /api/v1/orders/guest-checkout returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest-checkout')
        .send({
          guest_email: `adv_alias_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Alias Attacker',
            phone: '01711223344',
            street_address: 'Gulshan',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: testCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-07a: Direct guest order with discount_amount: 100 returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_inject_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Injector Guest',
            phone: '01711223344',
            street_address: 'Dhanmondi',
            city: 'Dhaka',
            postal_code: '1205',
          },
          discount_amount: 100.00,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-07b: Direct guest order with string discount_amount: "250.00" returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_string_inject_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'String Injector Guest',
            phone: '01711223344',
            street_address: 'Uttara',
            city: 'Dhaka',
            postal_code: '1230',
          },
          discount_amount: '250.00',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-EDGE-04: Non-string coupon_code (numeric: 12345) handled safely without 500 crash', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_numeric_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Numeric Tester',
            phone: '01711223344',
            street_address: 'Mirpur',
            city: 'Dhaka',
            postal_code: '1216',
          },
          coupon_code: 12345,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      // typeof coupon_code !== 'string' -> cleanCouponCode is null -> legitimate guest order with 0 discount
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });

    it('BV-EDGE-05: SQL injection attempt in coupon_code rejected with HTTP 400 safely', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_sqli_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'SQLi Attacker',
            phone: '01711223344',
            street_address: 'Mohakhali',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: "' OR '1'='1",
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-EDGE-06: XSS payload in coupon_code rejected with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `adv_xss_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'XSS Attacker',
            phone: '01711223344',
            street_address: 'Baridhara',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: '<script>alert("XSS")</script>',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('BV-08: Legitimate guest checkout with coupon_code: null creates order with 0 discount (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `legit_guest_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Legit Guest User',
            phone: '01711223344',
            street_address: 'Dhanmondi 27',
            city: 'Dhaka',
            postal_code: '1209',
          },
          coupon_code: null,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
      assert.strictEqual(Number(order.total_amount), Number(order.subtotal) + Number(order.shipping_fee));
    });

    it('BV-09a: Legitimate guest checkout with coupon_code: "" creates order with 0 discount (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `empty_guest_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Empty String Guest',
            phone: '01711223344',
            street_address: 'Badda',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: '',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });

    it('BV-09b: Legitimate guest checkout with whitespace coupon_code creates order with 0 discount (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `whitespace_guest_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Whitespace Guest',
            phone: '01711223344',
            street_address: 'Mohammadpur',
            city: 'Dhaka',
            postal_code: '1207',
          },
          coupon_code: '   \t  ',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });

    it('BV-09c: Legitimate guest checkout with omitted coupon_code creates order with 0 discount (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `omitted_guest_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Omitted Key Guest',
            phone: '01711223344',
            street_address: 'Tejgaon',
            city: 'Dhaka',
            postal_code: '1208',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });
  });

  // ============================================================================
  // SECTION 3: Checkout Endpoint Delegation Rules (/api/v1/checkout/orders)
  // ============================================================================
  describe('3. Checkout Delegation Security (/api/v1/checkout/orders)', () => {
    it('BV-10a: Unauthenticated POST /api/v1/checkout/orders with coupon_code returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Unauth Checkout Attacker',
            phone: '01711223344',
            street_address: 'Bashundhara',
            city: 'Dhaka',
            postal_code: '1229',
          },
          coupon_code: testCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-10b: Unauthenticated POST /api/v1/checkout alias with coupon_code returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout')
        .send({
          shipping_address: {
            recipient_name: 'Unauth Checkout Attacker',
            phone: '01711223344',
            street_address: 'Bashundhara',
            city: 'Dhaka',
            postal_code: '1229',
          },
          coupon_code: testCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-10c: Unauthenticated POST /api/v1/checkout/orders with discount_amount returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Unauth Checkout Injector',
            phone: '01711223344',
            street_address: 'Bashundhara',
            city: 'Dhaka',
            postal_code: '1229',
          },
          discount_amount: 150.00,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('BV-10d: Unauthenticated POST /api/v1/checkout/orders with coupon_code: null succeeds with HTTP 201', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          guest_email: `unauth_checkout_legit_${ts}@mavllin.test`,
          shipping_address: {
            recipient_name: 'Unauth Legit Guest',
            phone: '01711223344',
            street_address: 'Mirpur DOHS',
            city: 'Dhaka',
            postal_code: '1216',
          },
          coupon_code: null,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });

    it('BV-POS-02: Authenticated customer places order with coupon_code, verifies financial invariants (HTTP 201)', async () => {
      const [[coupBefore]] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [testCouponId]);

      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Auth Customer Tester',
            phone: '01711223344',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: testCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      // Verify invariants:
      // Subtotal = 2500.00 (meets >= 2500 free shipping)
      // Discount = 15% of 2500.00 = 375.00
      // Shipping = 0.00 (subtotal >= 2500)
      // Total = 2500 - 375 + 0 = 2125.00
      assert.strictEqual(order.user_id, 2);
      assert.strictEqual(order.coupon_id, testCouponId);
      assert.strictEqual(Number(order.subtotal), 2500.00);
      assert.strictEqual(Number(order.discount_amount), 375.00);
      assert.strictEqual(Number(order.total_amount), 2125.00);

      // Verify used_count in MySQL was incremented by 1
      const [[coupAfter]] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [testCouponId]);
      assert.strictEqual(coupAfter.used_count, coupBefore.used_count + 1);
    });
  });

  // ============================================================================
  // SECTION 4: Database Persistent Invariant Verification
  // ============================================================================
  describe('4. MySQL Database Invariant Verification', () => {
    it('DB-INV-01: Zero guest orders exist in MySQL with coupon_id IS NOT NULL or discount_amount > 0', async () => {
      const [violations] = await pool.query(
        `SELECT id, order_number, user_id, discount_amount, coupon_id
         FROM orders
         WHERE user_id IS NULL AND (discount_amount > 0 OR coupon_id IS NOT NULL)`
      );

      assert.strictEqual(
        violations.length,
        0,
        `Found ${violations.length} database invariant violation(s): ${JSON.stringify(violations)}`
      );
    });
  });
});
