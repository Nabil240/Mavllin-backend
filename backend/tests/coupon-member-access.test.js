const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const env = require('../src/config/env');
const { getAdminToken } = require('./helpers/auth.helper');
const OrderModel = require('../src/models/order.model');

describe('Milestone M6-A: Coupon Member Access Control (Whitelist) & Custom Per-Member Limits', () => {
  let adminToken;
  let whitelistedToken; // User ID 2
  let nonWhitelistedToken; // User ID 4
  let testProductId;
  let testVariantId;

  // Coupon IDs and codes
  let restrictedCouponId;
  let universalCouponId;
  let overallLimitedCouponId;

  const createdOrderIds = [];
  const ts = Date.now();
  const restrictedCouponCode = `RESTRICT_${ts}`;
  const universalCouponCode = `UNIV_${ts}`;
  const overallLimitedCouponCode = `OVERALL_${ts}`;

  before(async () => {
    adminToken = getAdminToken();
    whitelistedToken = jwt.sign(
      { id: 2, email: 'jane.customer@example.com', role: 'customer' },
      env.jwt.secret,
      { expiresIn: '1h' }
    );
    nonWhitelistedToken = jwt.sign(
      { id: 4, email: 'customer@mavllin.com', role: 'customer' },
      env.jwt.secret,
      { expiresIn: '1h' }
    );

    // 1. Create a dedicated test product and variant for checkout tests
    const [pRes] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 2500.00, 1)`,
      [`Member Whitelist Test Shirt ${ts}`, `whitelist-test-shirt-${ts}`]
    );
    testProductId = pRes.insertId;

    const [vRes] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, 'M', 'Olive', 2500.00, 100, 1)`,
      [testProductId, `SKU-WHITELIST-${ts}`]
    );
    testVariantId = vRes.insertId;

    // 2. Create Member-Restricted Coupon (is_universal = 0, 20% off, min order 1000)
    const [c1Res] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'percentage', 20.00, 1000.00, 1, 0)`,
      [restrictedCouponCode]
    );
    restrictedCouponId = c1Res.insertId;

    // 3. Create Universal Coupon (is_universal = 1, fixed 500 off, min order 1000)
    const [c2Res] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 500.00, 1000.00, 1, 1)`,
      [universalCouponCode]
    );
    universalCouponId = c2Res.insertId;

    // 4. Create Overall Limited Coupon (overall usage limit = 1)
    const [c3Res] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, is_active, is_universal)
       VALUES (?, 'fixed', 200.00, 1000.00, 1, 1, 0)`,
      [overallLimitedCouponCode]
    );
    overallLimitedCouponId = c3Res.insertId;
  });

  after(async () => {
    // Delete created test orders (restores variant stock)
    for (const orderId of createdOrderIds) {
      await OrderModel.delete(orderId).catch(() => {});
    }

    // Delete test coupon members
    if (restrictedCouponId) {
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [restrictedCouponId]);
      await pool.query('DELETE FROM coupons WHERE id = ?', [restrictedCouponId]);
    }
    if (universalCouponId) {
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [universalCouponId]);
      await pool.query('DELETE FROM coupons WHERE id = ?', [universalCouponId]);
    }
    if (overallLimitedCouponId) {
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [overallLimitedCouponId]);
      await pool.query('DELETE FROM coupons WHERE id = ?', [overallLimitedCouponId]);
    }

    // Clean up variant and product
    if (testVariantId) {
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  // ============================================================================
  // SUITE 1: Admin Member Whitelist Management APIs (CRUD & RBAC)
  // ============================================================================
  describe('1. Admin Coupon Whitelist Management APIs', () => {
    it('rejects unauthenticated GET /:id/members with 401', async () => {
      const res = await request(app).get(`/api/v1/coupons/${restrictedCouponId}/members`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects customer role on GET /:id/members with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${whitelistedToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('returns empty members list for newly created coupon', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 0);
    });

    it('assigns member by user_id with custom usage limit (TC-BE-01)', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 2, usage_limit: 2 });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, 2);
      assert.strictEqual(res.body.data.usage_limit, 2);
      assert.strictEqual(res.body.data.used_count, 0);
      assert.strictEqual(res.body.data.remaining_uses, 2);
      assert.strictEqual(res.body.data.customer_email, 'jane.customer@example.com');
    });

    it('rejects duplicate member assignment with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 2, usage_limit: 5 });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already whitelisted/i);
    });

    it('rejects assigning non-existent user_id with 404', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 999999, usage_limit: 1 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    it('assigns member by email with custom usage limit', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'customer@mavllin.com', usage_limit: 3 });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, 4);
      assert.strictEqual(res.body.data.usage_limit, 3);
      assert.strictEqual(res.body.data.used_count, 0);
      assert.strictEqual(res.body.data.remaining_uses, 3);
      assert.strictEqual(res.body.data.customer_email, 'customer@mavllin.com');
    });

    it('rejects assigning non-existent email with 404', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'nonexistent.user.999@mavllin.com', usage_limit: 1 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    it('retrieves whitelisted members list with customer details (TC-BE-02)', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 2);

      const user2Entry = res.body.data.find(m => m.user_id === 2);
      assert.ok(user2Entry);
      assert.strictEqual(user2Entry.usage_limit, 2);
      assert.strictEqual(user2Entry.remaining_uses, 2);

      const user4Entry = res.body.data.find(m => m.user_id === 4);
      assert.ok(user4Entry);
      assert.strictEqual(user4Entry.usage_limit, 3);
    });

    it('updates member custom usage limit (TC-BE-03)', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${restrictedCouponId}/members/4`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 5 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, 4);
      assert.strictEqual(res.body.data.usage_limit, 5);
      assert.strictEqual(res.body.data.remaining_uses, 5);
    });

    it('rejects updating limit for non-whitelisted member with 404', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${restrictedCouponId}/members/6`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 10 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });

    it('removes member from whitelist (TC-BE-04)', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${restrictedCouponId}/members/4`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      // Verify removal
      const listRes = await request(app)
        .get(`/api/v1/coupons/${restrictedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(listRes.body.data.length, 1);
      assert.strictEqual(listRes.body.data[0].user_id, 2);
    });

    it('rejects removing member not on whitelist with 404', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${restrictedCouponId}/members/4`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ============================================================================
  // SUITE 2: Real-Time Coupon Validation Access Control (/api/v1/coupons/validate)
  // ============================================================================
  describe('2. Real-Time Coupon Validation Access Control', () => {
    it('allows authenticated member to validate universal coupon (TC-BE-09)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${nonWhitelistedToken}`)
        .send({ code: universalCouponCode, subtotal: 2500 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.discount_amount, 500);
      assert.strictEqual(res.body.data.is_universal, true);
    });

    it('rejects unauthenticated guest for restricted coupon with 401 (TC-BE-05)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: restrictedCouponCode, subtotal: 2500 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required/i);
    });

    it('rejects authenticated non-whitelisted member with 403 Forbidden (TC-BE-06)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${nonWhitelistedToken}`)
        .send({ code: restrictedCouponCode, subtotal: 2500 });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('whitelisted member successfully validates coupon with usage limit metadata (TC-BE-07)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({ code: restrictedCouponCode, subtotal: 2500 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.discount_amount, 500); // 20% of 2500
      assert.strictEqual(res.body.data.is_universal, false);
      assert.strictEqual(res.body.data.member_usage_limit, 2);
      assert.strictEqual(res.body.data.member_used_count, 0);
      assert.strictEqual(res.body.data.member_remaining_uses, 2);
      assert.ok(res.body.data.member_usage);
      assert.strictEqual(res.body.data.member_usage.remaining_uses, 2);
    });
  });

  // ============================================================================
  // SUITE 3: Order Checkout Enforcement & Usage Decrementing
  // ============================================================================
  describe('3. Order Checkout Enforcement & Usage Decrementing', () => {
    it('rejects guest checkout with member-restricted coupon with 400 (TC-BE-10)', async () => {
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
          coupon_code: restrictedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /exclusively available to registered customers/i);
    });

    it('rejects non-whitelisted member checkout with 403 (TC-BE-11)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${nonWhitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Non Whitelisted',
            phone: '01711111111',
            email: 'customer@mavllin.com',
            street_address: 'Dhanmondi 27',
            city: 'Dhaka',
            postal_code: '1209',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: restrictedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('whitelisted member checkout succeeds and atomically increments member usage count (TC-BE-12)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: restrictedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.strictEqual(order.coupon_id, restrictedCouponId);
      assert.strictEqual(Number(order.discount_amount), 500);

      // Verify member usage count in DB
      const [cmRows] = await pool.query(
        'SELECT * FROM coupon_members WHERE coupon_id = ? AND user_id = ?',
        [restrictedCouponId, 2]
      );
      assert.strictEqual(cmRows[0].used_count, 1);

      // Verify global coupon usage count in DB
      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [restrictedCouponId]);
      assert.strictEqual(cRows[0].used_count, 1);
    });

    it('whitelisted member succeeds with second order reaching their limit of 2', async () => {
      // Validate first: remaining_uses should now be 1
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({ code: restrictedCouponCode, subtotal: 2500 });

      assert.strictEqual(valRes.statusCode, 200);
      assert.strictEqual(valRes.body.data.member_used_count, 1);
      assert.strictEqual(valRes.body.data.member_remaining_uses, 1);

      // Place 2nd order
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: restrictedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      createdOrderIds.push(res.body.data.id);

      // Verify member used_count is now 2
      const [cmRows] = await pool.query(
        'SELECT * FROM coupon_members WHERE coupon_id = ? AND user_id = ?',
        [restrictedCouponId, 2]
      );
      assert.strictEqual(cmRows[0].used_count, 2);
    });

    it('whitelisted member validation rejected when custom limit reached (TC-BE-08)', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({ code: restrictedCouponCode, subtotal: 2500 });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /reached your usage limit/i);
    });

    it('whitelisted member checkout rejected when custom limit reached (TC-BE-13)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: restrictedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /reached your usage limit/i);
    });
  });

  // ============================================================================
  // SUITE 4: Global Usage Limits & Universal Enforcement
  // ============================================================================
  describe('4. Global Limit Precedence & Universal Checkout', () => {
    it('universal coupon checkout increments global used_count (TC-BE-14)', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${nonWhitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Universal Customer',
            phone: '01733333333',
            email: 'customer@mavllin.com',
            street_address: 'Uttara Sector 3',
            city: 'Dhaka',
            postal_code: '1230',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: universalCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      createdOrderIds.push(res.body.data.id);

      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [universalCouponId]);
      assert.ok(cRows[0].used_count >= 1);
    });

    it('overall usage limit takes precedence when reached (TC-BE-15)', async () => {
      // Whitelist user 2 for overallLimitedCouponId with limit 5
      await request(app)
        .post(`/api/v1/coupons/${overallLimitedCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 2, usage_limit: 5 });

      // Place first order to exhaust overall limit (limit = 1)
      const res1 = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: overallLimitedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res1.statusCode, 201);
      createdOrderIds.push(res1.body.data.id);

      // Attempt second order: member has individual remaining uses (1 used of 5), but overall limit is exhausted
      const res2 = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${whitelistedToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 1',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: overallLimitedCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res2.statusCode, 400);
      assert.match(res2.body.message, /usage limit reached/i);
    });
  });
});
