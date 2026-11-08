const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');
const OrderModel = require('../src/models/order.model');

describe('Backend Coupon Authentication Enforcement & Guest Order Protection (Milestone 5)', () => {
  let adminToken;
  let customerToken;
  let testProductId;
  let testVariantId;
  let testCouponId;
  const createdOrderIds = [];
  const ts = Date.now();
  const testCouponCode = `AUTHCOUP${ts}`;

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    // 1. Create a dedicated test product and variant for testing order placement
    const [pRes] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 1800.00, 1)`,
      [`Auth Test Linen Jacket ${ts}`, `auth-test-jacket-${ts}`]
    );
    testProductId = pRes.insertId;

    const [vRes] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, 'L', 'Navy', 1800.00, 50, 1)`,
      [testProductId, `SKU-AUTH-${ts}`]
    );
    testVariantId = vRes.insertId;

    // 2. Create a dedicated active test coupon (10% off on subtotal >= 1500)
    const [cRes] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active)
       VALUES (?, 'percentage', 10.00, 1500.00, 1)`,
      [testCouponCode]
    );
    testCouponId = cRes.insertId;
  });

  after(async () => {
    // 1. Delete created test orders (safely restoring variant stock)
    for (const orderId of createdOrderIds) {
      await OrderModel.delete(orderId).catch(() => {});
    }

    // 2. Delete test coupon
    if (testCouponId) {
      await pool.query('DELETE FROM coupons WHERE id = ?', [testCouponId]);
    }

    // 3. Delete test variant & product
    if (testVariantId) {
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  // ============================================================================
  // SUITE 1: Coupon Validation Endpoint Authentication (/api/v1/coupons/validate)
  // ============================================================================
  describe('1. POST /api/v1/coupons/validate Authentication Rules', () => {
    it('rejects unauthenticated coupon validation with HTTP 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: testCouponCode, subtotal: 2000.00 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required/i);
    });

    it('rejects coupon validation with malformed Bearer token with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', 'Bearer invalid.token.payload')
        .send({ code: testCouponCode, subtotal: 2000.00 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid or expired token/i);
    });

    it('successfully validates coupon for authenticated registered customer (HTTP 200)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: testCouponCode, subtotal: 2000.00 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.code, testCouponCode);
      assert.strictEqual(Number(res.body.data.discount_amount), 200.00); // 10% of 2000
    });

    it('returns 404 for non-existent coupon for authenticated customer', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'NONEXISTENT_COUPON_999', subtotal: 2000.00 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid coupon code/i);
    });

    it('returns 400 when authenticated customer order subtotal is below minimum order amount', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: testCouponCode, subtotal: 1000.00 }); // min is 1500

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /must be at least/i);
    });
  });

  // ============================================================================
  // SUITE 2: Guest Order Rejection with Coupon (/api/v1/orders/guest)
  // ============================================================================
  describe('2. POST /api/v1/orders/guest Coupon Restriction Rules', () => {
    it('rejects guest order containing coupon_code with HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `guest_coupon_${ts}@example.com`,
          shipping_address: {
            recipient_name: 'Guest Tester',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
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

    it('rejects guest order attempting discount_amount injection with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `guest_inject_${ts}@example.com`,
          shipping_address: {
            recipient_name: 'Guest Tester',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          discount_amount: 180.00,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /registered customers|log in/i);
    });

    it('allows legitimate guest checkout with coupon_code: null (HTTP 201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: `legit_guest_${ts}@example.com`,
          shipping_address: {
            recipient_name: 'Legit Guest',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: null,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
      assert.strictEqual(order.coupon_id, null);
      assert.strictEqual(Number(order.total_amount), Number(order.subtotal) + Number(order.shipping_fee));
    });
  });

  // ============================================================================
  // SUITE 3: Checkout Endpoint Delegation Rules (/api/v1/checkout/orders)
  // ============================================================================
  describe('3. POST /api/v1/checkout/orders Delegation & Guard Rules', () => {
    it('rejects unauthenticated checkout order with coupon_code with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Unauth Checkout Tester',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
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

    it('allows legitimate unauthenticated checkout order with coupon_code: null (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          guest_email: `unauth_checkout_${ts}@example.com`,
          shipping_address: {
            recipient_name: 'Unauth Checkout Tester',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          coupon_code: null,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(Number(order.discount_amount), 0.00);
    });

    it('allows authenticated customer checkout order with coupon_code applied (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Auth Customer Tester',
            phone: '01711223344',
            street_address: 'House 1, Road 2',
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

      assert.strictEqual(order.user_id, 2); // customerToken ID
      assert.strictEqual(Number(order.discount_amount), 180.00); // 10% of 1800
      assert.strictEqual(order.coupon_id, testCouponId);
      assert.strictEqual(
        Number(order.total_amount),
        Number((Number(order.subtotal) - 180.00 + Number(order.shipping_fee)).toFixed(2))
      );
    });
  });
});
