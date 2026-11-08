const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');
const OrderModel = require('../src/models/order.model');

describe('Universal Coupon Permission for Guests & Members', () => {
  let adminToken;
  let customerToken;
  let testProductId;
  let testVariantId;
  let memberCouponId;
  let universalCouponId;
  const createdOrderIds = [];
  const ts = Date.now();
  const memberCouponCode = `MEMBERONLY${ts}`;
  const universalCouponCode = `UNIVERSAL${ts}`;

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    // 1. Create a test product with stock
    const [pRes] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 2000.00, 1)`,
      [`Universal Test Linen Shirt ${ts}`, `universal-test-shirt-${ts}`]
    );
    testProductId = pRes.insertId;

    const [vRes] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, 'XL', 'Beige', 2000.00, 50, 1)`,
      [testProductId, `SKU-UNIV-${ts}`]
    );
    testVariantId = vRes.insertId;

    // 2. Create Members-Only Coupon (is_universal = 0)
    const [c1Res] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'percentage', 10.00, 1000.00, 1, 0)`,
      [memberCouponCode]
    );
    memberCouponId = c1Res.insertId;

    // 3. Create Universal Coupon (is_universal = 1)
    const [c2Res] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 300.00, 1000.00, 1, 1)`,
      [universalCouponCode]
    );
    universalCouponId = c2Res.insertId;
  });

  after(async () => {
    for (const orderId of createdOrderIds) {
      await OrderModel.delete(orderId).catch(() => {});
    }
    if (memberCouponId) {
      await pool.query('DELETE FROM coupons WHERE id = ?', [memberCouponId]);
    }
    if (universalCouponId) {
      await pool.query('DELETE FROM coupons WHERE id = ?', [universalCouponId]);
    }
    if (testVariantId) {
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  describe('Validation Endpoint (/api/v1/coupons/validate)', () => {
    it('rejects unauthenticated guest for members-only coupon with 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: memberCouponCode, subtotal: 2000 });

      assert.equal(res.status, 401);
      assert.ok(res.body.message.includes('Authentication required'));
    });

    it('allows authenticated customer to validate members-only coupon', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: memberCouponCode, subtotal: 2000 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.discount_amount, 200);
      assert.equal(res.body.data.is_universal, false);
    });

    it('allows unauthenticated guest to validate universal coupon when permission is given', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: universalCouponCode, subtotal: 2000 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.discount_amount, 300);
      assert.equal(res.body.data.is_universal, true);
    });
  });

  describe('Guest Checkout & Order Placement with Universal Coupon', () => {
    it('rejects guest checkout using members-only coupon with 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Guest Tester',
            phone: '01700000001',
            email: 'guest@test.com',
            street_address: 'Banani Road 11',
            city: 'Dhaka',
            postal_code: '1213',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: memberCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('exclusively available to registered customers'));
    });

    it('allows guest checkout with universal coupon, applies discount, and links coupon_id', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Universal Guest User',
            phone: '01700000002',
            email: 'uniguest@test.com',
            street_address: 'Gulshan 2 Avenue',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: universalCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.equal(order.user_id, null);
      assert.equal(order.guest_email, 'uniguest@test.com');
      assert.equal(Number(order.subtotal), 2000);
      assert.equal(Number(order.discount_amount), 300);
      assert.equal(order.coupon_id, universalCouponId);

      // Verify coupon used_count was incremented
      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [universalCouponId]);
      assert.ok(cRows[0].used_count >= 1);
    });
  });

  describe('Admin Coupon Universal Permission Management', () => {
    it('creates a new coupon with universal permission flag', async () => {
      const newCode = `UNIVADMIN${ts}`;
      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: newCode,
          discount_type: 'percentage',
          discount_value: 15,
          min_order_amount: 500,
          is_universal: 1,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.is_universal, 1);

      // Cleanup
      await pool.query('DELETE FROM coupons WHERE id = ?', [res.body.data.id]);
    });

    it('updates existing coupon to toggle universal permission', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${memberCouponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_universal: 1 });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.is_universal, 1);

      // Toggle back
      await request(app)
        .put(`/api/v1/coupons/${memberCouponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_universal: 0 });
    });
  });
});
