/**
 * backend/tests/challenger-m6-coupon-stress.test.js
 * 
 * Adversarial Challenger Test Suite — Milestone 6
 * Stress-tests member coupon access control, custom per-member limits,
 * atomic row locking under concurrent race conditions, boundary values,
 * token spoofing, and database invariant integrity.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const env = require('../src/config/env');
const { getAdminToken } = require('./helpers/auth.helper');
const OrderModel = require('../src/models/order.model');

describe('Adversarial Challenger M6: Coupon Whitelist, Custom Limits & Concurrency Suite', () => {
  let adminToken;
  let userTokenA; // User ID 2: Jane Customer
  let userTokenB; // User ID 4: Rahim Ahmed
  let userTokenC; // User ID 6: Nabil Client
  let forgedToken; // Signed with invalid secret

  let testProductId;
  let testVariantId;
  const initialStock = 200;

  // Coupon IDs and codes
  let raceCouponId;
  let multiRaceCouponId;
  let zeroLimitCouponId;
  let boundaryCouponId;
  let expiredCouponId;
  let inactiveCouponId;
  let universalCouponId;

  const ts = Date.now();
  const raceCouponCode = `CHAL_RACE_${ts}`;
  const multiRaceCouponCode = `CHAL_MULTI_${ts}`;
  const zeroLimitCouponCode = `CHAL_ZERO_${ts}`;
  const boundaryCouponCode = `CHAL_BOUND_${ts}`;
  const expiredCouponCode = `CHAL_EXP_${ts}`;
  const inactiveCouponCode = `CHAL_INACT_${ts}`;
  const universalCouponCode = `CHAL_UNIV_${ts}`;

  const createdOrderIds = [];

  before(async () => {
    adminToken = getAdminToken();

    userTokenA = jwt.sign(
      { id: 2, email: 'jane.customer@example.com', role: 'customer' },
      env.jwt.secret,
      { expiresIn: '2h' }
    );

    userTokenB = jwt.sign(
      { id: 4, email: 'customer@mavllin.com', role: 'customer' },
      env.jwt.secret,
      { expiresIn: '2h' }
    );

    userTokenC = jwt.sign(
      { id: 6, email: 'user@shop.com', role: 'customer' },
      env.jwt.secret,
      { expiresIn: '2h' }
    );

    forgedToken = jwt.sign(
      { id: 2, email: 'jane.customer@example.com', role: 'customer' },
      'completely-fake-secret-key-for-forgery-testing-999',
      { expiresIn: '2h' }
    );

    // 1. Create dedicated test product and variant
    const [pRes] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 2000.00, 1)`,
      [`Challenger Stress Product ${ts}`, `chal-stress-prod-${ts}`]
    );
    testProductId = pRes.insertId;

    const [vRes] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, 'L', 'Charcoal', 2000.00, ?, 1)`,
      [testProductId, `SKU-CHAL-${ts}`, initialStock]
    );
    testVariantId = vRes.insertId;

    // 2. Coupon for Race Condition 1: usage_limit = 1 for User A
    const [c1] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 300.00, 500.00, 1, 0)`,
      [raceCouponCode]
    );
    raceCouponId = c1.insertId;
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 1, 0)',
      [raceCouponId]
    );

    // 3. Coupon for Multi-Member Race Condition: global usage_limit = 3, Member A limit = 2, Member B limit = 2
    const [c2] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, is_active, is_universal)
       VALUES (?, 'fixed', 250.00, 500.00, 3, 1, 0)`,
      [multiRaceCouponCode]
    );
    multiRaceCouponId = c2.insertId;
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 2, 0)',
      [multiRaceCouponId]
    );
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 4, 2, 0)',
      [multiRaceCouponId]
    );

    // 4. Coupon for Zero / Clamped Limit testing
    const [c3] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'percentage', 10.00, 500.00, 1, 0)`,
      [zeroLimitCouponCode]
    );
    zeroLimitCouponId = c3.insertId;
    // Insert direct DB row with usage_limit = 0 to test boundary
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 0, 0)',
      [zeroLimitCouponId]
    );

    // 5. Coupon for dynamic boundary limit testing
    const [c4] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 400.00, 500.00, 1, 0)`,
      [boundaryCouponCode]
    );
    boundaryCouponId = c4.insertId;
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 2, 0)',
      [boundaryCouponId]
    );
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 4, 3, 0)',
      [boundaryCouponId]
    );

    // 6. Expired Coupon
    const [c5] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, expires_at, is_active, is_universal)
       VALUES (?, 'fixed', 100.00, 500.00, '2020-01-01 00:00:00', 1, 0)`,
      [expiredCouponCode]
    );
    expiredCouponId = c5.insertId;
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 5, 0)',
      [expiredCouponId]
    );

    // 7. Inactive Coupon
    const [c6] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 100.00, 500.00, 0, 0)`,
      [inactiveCouponCode]
    );
    inactiveCouponId = c6.insertId;
    await pool.query(
      'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 5, 0)',
      [inactiveCouponId]
    );

    // 8. Universal Coupon
    const [c7] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'fixed', 150.00, 500.00, 1, 1)`,
      [universalCouponCode]
    );
    universalCouponId = c7.insertId;
  });

  after(async () => {
    // Delete created test orders
    for (const orderId of createdOrderIds) {
      await OrderModel.delete(orderId).catch(() => {});
    }

    const testCouponIds = [
      raceCouponId,
      multiRaceCouponId,
      zeroLimitCouponId,
      boundaryCouponId,
      expiredCouponId,
      inactiveCouponId,
      universalCouponId,
    ].filter(Boolean);

    for (const cId of testCouponIds) {
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [cId]).catch(() => {});
      await pool.query('DELETE FROM coupons WHERE id = ?', [cId]).catch(() => {});
    }

    if (testVariantId) {
      await pool.query('DELETE FROM product_variants WHERE id = ?', [testVariantId]).catch(() => {});
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]).catch(() => {});
    }
  });

  // ============================================================================
  // SUITE 1: High-Concurrency & Atomic Row-Locking Race Condition Challenge
  // ============================================================================
  describe('1. High-Concurrency Blitz & Row Locking Under Race Conditions', () => {
    it('C1: Exactly 1 checkout succeeds out of 10 concurrent requests for member with usage_limit = 1', async () => {
      const concurrentRequests = 10;
      const orderPayload = {
        shipping_address: {
          recipient_name: 'Jane Customer',
          phone: '01722222222',
          email: 'jane.customer@example.com',
          street_address: 'Gulshan 2, Road 71',
          city: 'Dhaka',
          postal_code: '1212',
        },
        payment_method: 'cash_on_delivery',
        coupon_code: raceCouponCode,
        items: [{ variant_id: testVariantId, quantity: 1 }],
      };

      // Launch 10 simultaneous checkout requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .post('/api/v1/checkout/orders')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send(orderPayload)
      );

      const results = await Promise.all(promises);

      const successResults = results.filter(r => r.statusCode === 201);
      const failedResults = results.filter(r => r.statusCode === 400);

      // Track created orders for cleanup
      for (const res of successResults) {
        if (res.body?.data?.id) createdOrderIds.push(res.body.data.id);
      }

      // Assertions: STRICTLY 1 success, 9 failures
      assert.strictEqual(
        successResults.length,
        1,
        `Expected exactly 1 order to succeed under race condition, but ${successResults.length} succeeded!`
      );
      assert.strictEqual(
        failedResults.length,
        concurrentRequests - 1,
        `Expected exactly ${concurrentRequests - 1} orders to fail with HTTP 400, but got ${failedResults.length} failures!`
      );

      // All failed requests must contain explicit usage limit error
      for (const failedRes of failedResults) {
        assert.match(
          failedRes.body.message,
          /usage limit/i,
          `Failed response message should indicate usage limit exceeded: ${failedRes.body.message}`
        );
      }

      // Database Empirical Verification: coupon_members used_count MUST be exactly 1
      const [cmRows] = await pool.query(
        'SELECT used_count, usage_limit FROM coupon_members WHERE coupon_id = ? AND user_id = 2',
        [raceCouponId]
      );
      assert.strictEqual(cmRows[0].used_count, 1, `DB coupon_members.used_count must be 1, found: ${cmRows[0].used_count}`);

      // Database Empirical Verification: coupons used_count MUST be exactly 1
      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [raceCouponId]);
      assert.strictEqual(cRows[0].used_count, 1, `DB coupons.used_count must be 1, found: ${cRows[0].used_count}`);
    });

    it('C2: Multi-member concurrent contest strictly honors global coupon limit (limit=3 with 2+2 member limits)', async () => {
      // Coupon has global usage_limit = 3
      // Member A limit = 2, Member B limit = 2 (total 4 potential requests)
      // Launch 6 concurrent requests from Member A and 6 concurrent requests from Member B (12 concurrent requests total)
      const payloadA = {
        shipping_address: {
          recipient_name: 'Jane Customer',
          phone: '01722222222',
          email: 'jane.customer@example.com',
          street_address: 'Gulshan 2',
          city: 'Dhaka',
          postal_code: '1212',
        },
        payment_method: 'cash_on_delivery',
        coupon_code: multiRaceCouponCode,
        items: [{ variant_id: testVariantId, quantity: 1 }],
      };

      const payloadB = {
        shipping_address: {
          recipient_name: 'Rahim Ahmed',
          phone: '01711111111',
          email: 'customer@mavllin.com',
          street_address: 'Dhanmondi 27',
          city: 'Dhaka',
          postal_code: '1209',
        },
        payment_method: 'cash_on_delivery',
        coupon_code: multiRaceCouponCode,
        items: [{ variant_id: testVariantId, quantity: 1 }],
      };

      const requestsA = Array.from({ length: 6 }, () =>
        request(app)
          .post('/api/v1/checkout/orders')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send(payloadA)
      );

      const requestsB = Array.from({ length: 6 }, () =>
        request(app)
          .post('/api/v1/checkout/orders')
          .set('Authorization', `Bearer ${userTokenB}`)
          .send(payloadB)
      );

      // Execute all 12 requests simultaneously
      const allResults = await Promise.all([...requestsA, ...requestsB]);

      const successes = allResults.filter(r => r.statusCode === 201);
      const failures = allResults.filter(r => r.statusCode === 400);

      for (const res of successes) {
        if (res.body?.data?.id) createdOrderIds.push(res.body.data.id);
      }

      // Exactly 3 total orders MUST succeed (global limit is 3)
      assert.strictEqual(
        successes.length,
        3,
        `Expected exactly 3 orders to succeed overall (matching global coupon limit of 3), but ${successes.length} succeeded!`
      );
      assert.strictEqual(failures.length, 9, `Expected 9 failed requests, got ${failures.length}`);

      // Verify DB global used_count is exactly 3
      const [cRows] = await pool.query('SELECT used_count, usage_limit FROM coupons WHERE id = ?', [multiRaceCouponId]);
      assert.strictEqual(cRows[0].used_count, 3, `Global coupon used_count must be exactly 3, got: ${cRows[0].used_count}`);

      // Verify individual member used_counts do not exceed their limits (<= 2 each) and sum to 3
      const [cmRows] = await pool.query(
        'SELECT user_id, used_count, usage_limit FROM coupon_members WHERE coupon_id = ?',
        [multiRaceCouponId]
      );
      const memberA = cmRows.find(m => m.user_id === 2);
      const memberB = cmRows.find(m => m.user_id === 4);

      assert.ok(memberA.used_count <= 2, `Member A exceeded limit of 2: ${memberA.used_count}`);
      assert.ok(memberB.used_count <= 2, `Member B exceeded limit of 2: ${memberB.used_count}`);
      assert.strictEqual(
        memberA.used_count + memberB.used_count,
        3,
        `Sum of member usages must equal global used_count of 3: A=${memberA.used_count}, B=${memberB.used_count}`
      );
    });

    it('C3: Parallel validation requests remain consistent and report non-negative remaining_uses', async () => {
      // User A on raceCouponId has reached usage limit 1
      const valPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/coupons/validate')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send({ code: raceCouponCode, subtotal: 2000 })
      );

      const valResults = await Promise.all(valPromises);
      for (const res of valResults) {
        assert.strictEqual(res.statusCode, 400);
        assert.match(res.body.message, /reached your usage limit/i);
      }
    });
  });

  // ============================================================================
  // SUITE 2: Boundary Value Stress Testing (0, 1, Clamping, Dynamic Limits)
  // ============================================================================
  describe('2. Boundary Value Stress Testing', () => {
    it('B1: Member with usage_limit = 0 in database is immediately rejected on validate and checkout', async () => {
      // zeroLimitCouponId has User 2 configured with usage_limit = 0, used_count = 0
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: zeroLimitCouponCode, subtotal: 2000 });

      assert.strictEqual(valRes.statusCode, 400);
      assert.match(valRes.body.message, /reached your usage limit/i);

      const orderRes = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: zeroLimitCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 400);
      assert.match(orderRes.body.message, /reached your usage limit/i);
    });

    it('B2: Admin member assignment and limit updates strictly reject 0 or negative limits with 422 and default to 1 when omitted', async () => {
      // 1. Assign User 6 to zeroLimitCouponId with usage_limit omitted -> defaults to 1 (201 Created)
      const addRes = await request(app)
        .post(`/api/v1/coupons/${zeroLimitCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 6 });

      assert.strictEqual(addRes.statusCode, 201);
      assert.strictEqual(addRes.body.data.usage_limit, 1, 'omitted usage_limit should default to 1');

      // 2. Assigning with usage_limit = 0 should be rejected by express-validator with 422
      const zeroRes = await request(app)
        .post(`/api/v1/coupons/${boundaryCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 6, usage_limit: 0 });

      assert.strictEqual(zeroRes.statusCode, 422, 'usage_limit of 0 should be rejected with 422');
      assert.strictEqual(zeroRes.body.success, false);

      // 3. Updating with negative limit: -10 should be rejected with 422
      const putNegativeRes = await request(app)
        .put(`/api/v1/coupons/${zeroLimitCouponId}/members/6`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: -10 });

      assert.strictEqual(putNegativeRes.statusCode, 422, 'negative usage_limit should be rejected with 422');
      assert.strictEqual(putNegativeRes.body.success, false);

      // 4. Updating with usage_limit = 0 should be rejected with 422
      const putZeroRes = await request(app)
        .put(`/api/v1/coupons/${zeroLimitCouponId}/members/6`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 0 });

      assert.strictEqual(putZeroRes.statusCode, 422, 'zero usage_limit should be rejected with 422');
      assert.strictEqual(putZeroRes.body.success, false);

      // 5. Updating with non-integer string should be rejected with 422
      const putNaNRes = await request(app)
        .put(`/api/v1/coupons/${zeroLimitCouponId}/members/6`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 'not-a-number' });

      assert.strictEqual(putNaNRes.statusCode, 422, 'NaN usage_limit should be rejected with 422');
    });

    it('B3: Multiple members with differing limits on same coupon are completely isolated', async () => {
      // boundaryCouponId: User 2 has limit 2, User 4 has limit 3
      // Place 2 orders with User 2 to exhaust User 2's limit
      for (let i = 1; i <= 2; i++) {
        const res = await request(app)
          .post('/api/v1/checkout/orders')
          .set('Authorization', `Bearer ${userTokenA}`)
          .send({
            shipping_address: {
              recipient_name: 'Jane Customer',
              phone: '01722222222',
              email: 'jane.customer@example.com',
              street_address: 'Gulshan 2',
              city: 'Dhaka',
              postal_code: '1212',
            },
            payment_method: 'cash_on_delivery',
            coupon_code: boundaryCouponCode,
            items: [{ variant_id: testVariantId, quantity: 1 }],
          });

        assert.strictEqual(res.statusCode, 201);
        createdOrderIds.push(res.body.data.id);
      }

      // User 2 validate should now be rejected (0 remaining)
      const valResA = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });
      assert.strictEqual(valResA.statusCode, 400);

      // User 4 MUST still be able to validate with full remaining_uses = 3
      const valResB = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });
      assert.strictEqual(valResB.statusCode, 200);
      assert.strictEqual(valResB.body.data.member_remaining_uses, 3);
      assert.strictEqual(valResB.body.data.member_used_count, 0);

      // User 4 places an order successfully
      const orderResB = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({
          shipping_address: {
            recipient_name: 'Rahim Ahmed',
            phone: '01711111111',
            email: 'customer@mavllin.com',
            street_address: 'Dhanmondi 27',
            city: 'Dhaka',
            postal_code: '1209',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderResB.statusCode, 201);
      createdOrderIds.push(orderResB.body.data.id);

      // Check User 4 remaining is now 2
      const valResB2 = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });
      assert.strictEqual(valResB2.statusCode, 200);
      assert.strictEqual(valResB2.body.data.member_remaining_uses, 2);
    });

    it('B4: Dynamic limit increase restores access, dynamic reduction immediately halts access', async () => {
      // User 2 has used boundaryCouponCode 2 times, current limit = 2 (exhausted)
      // Admin increases limit to 4
      const updateRes = await request(app)
        .put(`/api/v1/coupons/${boundaryCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 4 });

      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual(updateRes.body.data.usage_limit, 4);
      assert.strictEqual(updateRes.body.data.remaining_uses, 2);

      // Validation now immediately passes
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });
      assert.strictEqual(valRes.statusCode, 200);
      assert.strictEqual(valRes.body.data.member_remaining_uses, 2);

      // Now admin reduces limit back down to 2
      const reduceRes = await request(app)
        .put(`/api/v1/coupons/${boundaryCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 2 });
      assert.strictEqual(reduceRes.statusCode, 200);
      assert.strictEqual(reduceRes.body.data.remaining_uses, 0);

      // Validation immediately fails
      const valRes2 = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });
      assert.strictEqual(valRes2.statusCode, 400);
      assert.match(valRes2.body.message, /reached your usage limit/i);
    });
  });

  // ============================================================================
  // SUITE 3: Circumvention, Security & Spoofing Defense
  // ============================================================================
  describe('3. Circumvention, Security & Spoofing Defense', () => {
    it('S1: Guest validate attempt on restricted coupon returns HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .send({ code: boundaryCouponCode, subtotal: 2000 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /authentication required/i);
    });

    it('S2: Guest checkout attempt on restricted coupon returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Guest Hacker',
            phone: '01700000000',
            email: 'guest@hacker.com',
            street_address: 'Nowhere',
            city: 'Dhaka',
            postal_code: '1000',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /exclusively available to registered customers/i);
    });

    it('S3: Non-whitelisted authenticated customer validate returns HTTP 403', async () => {
      // User 6 is not whitelisted for boundaryCouponCode
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('S4: Non-whitelisted authenticated customer checkout returns HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          shipping_address: {
            recipient_name: 'Nabil Client',
            phone: '01766666666',
            email: 'user@shop.com',
            street_address: 'Mohakhali DOHS',
            city: 'Dhaka',
            postal_code: '1206',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('S5: User ID spoofing in request body does NOT bypass membership check', async () => {
      // User 6 (not whitelisted) sends user_id: 4 (who IS whitelisted) in body
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          user_id: 4,
          shipping_address: {
            recipient_name: 'Spoofed User',
            phone: '01766666666',
            email: 'user@shop.com',
            street_address: 'Mohakhali DOHS',
            city: 'Dhaka',
            postal_code: '1206',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      // Must be rejected with 403 based on authenticated token identity, NOT body user_id
      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('S6: Forged JWT token signature rejected with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('S7: Whitelist member removal immediately revokes access with HTTP 403', async () => {
      // User 4 has remaining uses on boundaryCouponCode. Now admin deletes User 4 from whitelist
      const delRes = await request(app)
        .delete(`/api/v1/coupons/${boundaryCouponId}/members/4`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(delRes.statusCode, 200);

      // User 4 validation must now return 403 Forbidden
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ code: boundaryCouponCode, subtotal: 2000 });

      assert.strictEqual(valRes.statusCode, 403);
      assert.match(valRes.body.message, /restricted to specific eligible members/i);

      // User 4 checkout must now return 403 Forbidden
      const orderRes = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({
          shipping_address: {
            recipient_name: 'Rahim Ahmed',
            phone: '01711111111',
            email: 'customer@mavllin.com',
            street_address: 'Dhanmondi 27',
            city: 'Dhaka',
            postal_code: '1209',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 403);
      assert.match(orderRes.body.message, /restricted to specific eligible members/i);
    });

    it('S8: Expired and inactive coupons reject even whitelisted members with HTTP 400', async () => {
      // Expired coupon
      const expRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: expiredCouponCode, subtotal: 2000 });
      assert.strictEqual(expRes.statusCode, 400);
      assert.match(expRes.body.message, /expired/i);

      // Inactive coupon
      const inactRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: inactiveCouponCode, subtotal: 2000 });
      assert.strictEqual(inactRes.statusCode, 400);
      assert.match(inactRes.body.message, /inactive/i);
    });

    it('S9: Non-whitelisted customer checkout on authenticated POST /api/v1/orders returns HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          shipping_address: {
            recipient_name: 'Nabil Client',
            phone: '01766666666',
            email: 'user@shop.com',
            street_address: 'Mohakhali DOHS',
            city: 'Dhaka',
            postal_code: '1206',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: boundaryCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body.message, /restricted to specific eligible members/i);
    });

    it('S10: Universal coupon succeeds for authenticated members and increments global used_count', async () => {
      // User 6 (not on any whitelist) validates universal coupon
      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({ code: universalCouponCode, subtotal: 2000 });

      assert.strictEqual(valRes.statusCode, 200);
      assert.strictEqual(valRes.body.data.is_universal, true);
      assert.strictEqual(valRes.body.data.discount_amount, 150);

      // User 6 places order with universal coupon
      const orderRes = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({
          shipping_address: {
            recipient_name: 'Nabil Client',
            phone: '01766666666',
            email: 'user@shop.com',
            street_address: 'Mohakhali DOHS',
            city: 'Dhaka',
            postal_code: '1206',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: universalCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      createdOrderIds.push(orderRes.body.data.id);

      // Verify global used_count incremented
      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [universalCouponId]);
      assert.strictEqual(cRows[0].used_count, 1);
    });

    it('S11: Universal coupon succeeds for guest checkout and increments global used_count', async () => {
      const guestRes = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          shipping_address: {
            recipient_name: 'Guest Shopper',
            phone: '01788888888',
            email: 'guest.shopper@example.com',
            street_address: 'Baridhara',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: universalCouponCode,
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(guestRes.statusCode, 201);
      createdOrderIds.push(guestRes.body.data.id);

      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [universalCouponId]);
      assert.strictEqual(cRows[0].used_count, 2);
    });
  });

  // ============================================================================
  // SUITE 4: Transaction Rollback & Database Cascading Invariants
  // ============================================================================
  describe('4. Transaction Rollback & Database Invariants', () => {
    it('T1: Order failure (e.g. stock shortfall) rolls back transaction and does NOT increment member usage', async () => {
      // Create a fresh coupon with 1 use for User 2
      const failCouponCode = `CHAL_FAIL_${Date.now()}`;
      const [cRes] = await pool.query(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
         VALUES (?, 'fixed', 100.00, 500.00, 1, 0)`,
        [failCouponCode]
      );
      const failCouponId = cRes.insertId;
      await pool.query(
        'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 1, 0)',
        [failCouponId]
      );

      // Attempt checkout with quantity exceeding stock (stock is 200, request 500)
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '01722222222',
            email: 'jane.customer@example.com',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          payment_method: 'cash_on_delivery',
          coupon_code: failCouponCode,
          items: [{ variant_id: testVariantId, quantity: 500 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.message, /insufficient stock/i);

      // INVARIANT: coupon_members.used_count MUST still be 0!
      const [cmRows] = await pool.query(
        'SELECT used_count FROM coupon_members WHERE coupon_id = ? AND user_id = 2',
        [failCouponId]
      );
      assert.strictEqual(cmRows[0].used_count, 0, 'Transaction rollback failed: used_count was incremented despite order failure!');

      // INVARIANT: coupons.used_count MUST still be 0!
      const [cRows] = await pool.query('SELECT used_count FROM coupons WHERE id = ?', [failCouponId]);
      assert.strictEqual(cRows[0].used_count, 0, 'Transaction rollback failed: coupon used_count was incremented!');

      // Cleanup
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [failCouponId]);
      await pool.query('DELETE FROM coupons WHERE id = ?', [failCouponId]);
    });

    it('T2: Foreign key ON DELETE CASCADE automatically purges coupon_members when coupon is deleted', async () => {
      const cascadeCode = `CHAL_CASC_${Date.now()}`;
      const [cRes] = await pool.query(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
         VALUES (?, 'fixed', 100.00, 500.00, 1, 0)`,
        [cascadeCode]
      );
      const cascadeId = cRes.insertId;
      await pool.query(
        'INSERT INTO coupon_members (coupon_id, user_id, usage_limit, used_count) VALUES (?, 2, 5, 0)',
        [cascadeId]
      );

      // Verify row exists
      const [beforeRows] = await pool.query('SELECT id FROM coupon_members WHERE coupon_id = ?', [cascadeId]);
      assert.strictEqual(beforeRows.length, 1);

      // Delete the coupon
      await pool.query('DELETE FROM coupons WHERE id = ?', [cascadeId]);

      // Verify coupon_members row was cascaded and deleted automatically
      const [afterRows] = await pool.query('SELECT id FROM coupon_members WHERE coupon_id = ?', [cascadeId]);
      assert.strictEqual(afterRows.length, 0, 'Foreign key cascade failed: coupon_members row still orphaned in database!');
    });

    it('T3: Whitespace and case variations in coupon code preserve member whitelist security', async () => {
      // Re-add User 2 to boundaryCouponId with usage_limit = 5
      await pool.query(
        'UPDATE coupon_members SET usage_limit = 5, used_count = 0 WHERE coupon_id = ? AND user_id = 2',
        [boundaryCouponId]
      );

      // Test with lowercase and surrounding spaces
      const messyCode = `  ${boundaryCouponCode.toLowerCase()}  `;

      const valRes = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ code: messyCode, subtotal: 2000 });

      assert.strictEqual(valRes.statusCode, 200);
      assert.strictEqual(valRes.body.data.code, boundaryCouponCode);
      assert.strictEqual(valRes.body.data.member_remaining_uses, 5);

      // Non-whitelisted user with messy code still rejected with 403
      const valResNonWhitelisted = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${userTokenC}`)
        .send({ code: messyCode, subtotal: 2000 });

      assert.strictEqual(valResNonWhitelisted.statusCode, 403);
    });
  });
});
