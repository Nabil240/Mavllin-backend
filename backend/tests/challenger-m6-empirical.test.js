const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const env = require('../src/config/env');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Empirical Challenger M6-2: Admin Coupon RBAC, Boundaries & Injection Resilience', () => {
  let adminToken;
  let staffToken;
  let customerToken;
  let testCouponId;
  const ts = Date.now();
  const testCouponCode = `CHAL_SEC_${ts}`;

  before(async () => {
    adminToken = getAdminToken();
    staffToken = jwt.sign(
      { id: 777, email: 'staff.tester@mavllin.com', role: 'staff' },
      env.jwt.secret,
      { expiresIn: '1h' }
    );
    customerToken = getCustomerToken();

    // Create a dedicated member-restricted coupon
    const [cRes] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, is_active, is_universal)
       VALUES (?, 'percentage', 15.00, 500.00, 1, 0)`,
      [testCouponCode]
    );
    testCouponId = cRes.insertId;
  });

  after(async () => {
    if (testCouponId) {
      await pool.query('DELETE FROM coupon_members WHERE coupon_id = ?', [testCouponId]);
      await pool.query('DELETE FROM coupons WHERE id = ?', [testCouponId]);
    }
  });

  // ==========================================================================
  // CHALLENGE 1: Admin RBAC & Route Security Boundaries
  // ==========================================================================
  describe('Challenge 1: Admin RBAC & Route Security Boundaries', () => {
    it('CHAL-RBAC-01: unauthenticated GET /:id/members rejected with 401', async () => {
      const res = await request(app).get(`/api/v1/coupons/${testCouponId}/members`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-02: unauthenticated POST /:id/members rejected with 401', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .send({ user_id: 2, usage_limit: 1 });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-03: unauthenticated PUT /:id/members/:userId rejected with 401', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .send({ usage_limit: 5 });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-04: unauthenticated DELETE /:id/members/:userId rejected with 401', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${testCouponId}/members/2`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-05: customer role GET /:id/members rejected with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-06: customer role POST /:id/members rejected with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ user_id: 2, usage_limit: 1 });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-07: customer role PUT /:id/members/:userId rejected with 403', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ usage_limit: 5 });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-08: customer role DELETE /:id/members/:userId rejected with 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-09: staff role GET /:id/members allowed (200 view permission)', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('CHAL-RBAC-10: staff role POST /:id/members forbidden with 403 (admin only)', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ user_id: 2, usage_limit: 1 });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-11: staff role PUT /:id/members/:userId forbidden with 403 (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ usage_limit: 3 });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('CHAL-RBAC-12: staff role DELETE /:id/members/:userId forbidden with 403 (admin only)', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${staffToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });
  });

  // ==========================================================================
  // CHALLENGE 2: Duplicate Member Assignment (HTTP 409 Conflict)
  // ==========================================================================
  describe('Challenge 2: Duplicate Member Assignment', () => {
    it('CHAL-DUP-01: allows initial member assignment by user_id returning 201', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 2, usage_limit: 3 });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user_id, 2);
      assert.strictEqual(res.body.data.usage_limit, 3);
    });

    it('CHAL-DUP-02: rejects duplicate assignment by same user_id with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 2, usage_limit: 5 });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already whitelisted/i);
    });

    it('CHAL-DUP-03: rejects duplicate assignment by matching email with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'jane.customer@example.com', usage_limit: 2 });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /already whitelisted/i);
    });
  });

  // ==========================================================================
  // CHALLENGE 3: Invalid Member Assignment (HTTP 404 & 422/400 Validation)
  // ==========================================================================
  describe('Challenge 3: Invalid Member Assignment', () => {
    it('CHAL-INV-01: non-existent numeric user_id returns 404 Not Found', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 987654, usage_limit: 1 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /user not found/i);
    });

    it('CHAL-INV-02: non-existent email returns 404 Not Found', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'nonexistent.person.999@mavllin.com', usage_limit: 1 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /user not found/i);
    });

    it('CHAL-INV-03: missing both user_id and email returns 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 2 });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /user id or email is required/i);
    });

    it('CHAL-INV-04: malformed email string fails validation with 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email-address', usage_limit: 1 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Input Validation (Negative/Zero Limits & Route Params)
  // ==========================================================================
  describe('Challenge 4: Input Validation (Limits & Route Params)', () => {
    it('CHAL-VAL-01: negative usage limit on POST rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 4, usage_limit: -5 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-02: zero usage limit on POST rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .post(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: 4, usage_limit: 0 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-03: negative usage limit on PUT rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: -1 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-04: zero usage limit on PUT rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 0 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-05: string/NaN usage limit on PUT rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 'invalid' });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-06: non-integer couponId param rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .get('/api/v1/coupons/not-an-integer/members')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });

    it('CHAL-VAL-07: non-integer userId param rejected with 422 Validation Error', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/not-a-user`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 5 });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Validation failed');
    });
  });

  // ==========================================================================
  // CHALLENGE 5: SQL Injection & XSS Attack Surface Resistance
  // ==========================================================================
  describe('Challenge 5: SQL Injection & XSS Attack Surface Resistance', () => {
    it('CHAL-SEC-01: SQL injection in coupon validate code is safely handled without error', async () => {
      const sqliPayloads = [
        "' OR 1=1 --",
        "'; DROP TABLE coupons; --",
        "' UNION SELECT 1, 'INJECT', 'fixed', 100, 0, 100, 0, NULL, 1, 1, NOW(), NOW() --",
        "\" OR \"\"=\"",
      ];

      for (const payload of sqliPayloads) {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ code: payload, subtotal: 1000 });

        // Must reject cleanly as 404 (coupon not found), NOT 500 SQL syntax or data leak
        assert.strictEqual(res.statusCode, 404, `Failed on payload: ${payload}`);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.message, /invalid coupon code/i);
      }
    });

    it('CHAL-SEC-02: SQL injection in admin coupon search query safely handled', async () => {
      const sqliSearch = "' OR '1'='1' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12 --";
      const res = await request(app)
        .get('/api/v1/coupons')
        .query({ search: sqliSearch })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('CHAL-SEC-03: SQL injection in member usage ledger search query safely handled', async () => {
      const sqliSearch = "admin' OR 1=1 --";
      const res = await request(app)
        .get('/api/v1/coupons/member-usage')
        .query({ search: sqliSearch, couponCode: "' OR 1=1 --" })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('CHAL-SEC-04: SQL injection in customer search autocomplete query safely handled', async () => {
      const sqliSearch = "' OR 1=1 --";
      const res = await request(app)
        .get('/api/v1/admin/customers')
        .query({ search: sqliSearch })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('CHAL-SEC-05: XSS payloads in coupon validate code handled safely', async () => {
      const xssPayload = '<script>alert(document.cookie)</script>';
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: xssPayload, subtotal: 1000 });

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /invalid coupon code/i);
    });

    it('CHAL-SEC-06: XSS payloads in customer search query handled safely', async () => {
      const xssQuery = '<img src=x onerror=alert(1)>';
      const res = await request(app)
        .get('/api/v1/admin/customers')
        .query({ search: xssQuery })
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 0);
    });
  });

  // ==========================================================================
  // CHALLENGE 6: Member Limit Update & Removal Verification
  // ==========================================================================
  describe('Challenge 6: Member Limit Update & Removal Verification', () => {
    it('CHAL-LIM-01: admin can configure and update custom limit for assigned member', async () => {
      const res = await request(app)
        .put(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usage_limit: 10 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.usage_limit, 10);
      assert.strictEqual(res.body.data.remaining_uses, 10);
    });

    it('CHAL-LIM-02: admin can view real-time member coupon usage and custom limits', async () => {
      const res = await request(app)
        .get(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].user_id, 2);
      assert.strictEqual(res.body.data[0].usage_limit, 10);
      assert.strictEqual(res.body.data[0].used_count, 0);
      assert.strictEqual(res.body.data[0].remaining_uses, 10);
    });

    it('CHAL-LIM-03: admin can remove whitelisted member', async () => {
      const res = await request(app)
        .delete(`/api/v1/coupons/${testCouponId}/members/2`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);

      // Verify empty list
      const listRes = await request(app)
        .get(`/api/v1/coupons/${testCouponId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(listRes.body.data.length, 0);
    });
  });
});
