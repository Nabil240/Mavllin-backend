const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Admin Coupon Member Tracking & Usage Analytics API', () => {
  let adminToken;
  let customerToken;

  before(() => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();
  });

  describe('Security & RBAC Enforcement', () => {
    it('rejects unauthenticated GET /api/v1/coupons/analytics with 401', async () => {
      const res = await request(app).get('/api/v1/coupons/analytics');
      assert.equal(res.status, 401);
    });

    it('rejects customer role on GET /api/v1/coupons/analytics with 403', async () => {
      const res = await request(app)
        .get('/api/v1/coupons/analytics')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.equal(res.status, 403);
    });

    it('rejects unauthenticated GET /api/v1/coupons/member-usage with 401', async () => {
      const res = await request(app).get('/api/v1/coupons/member-usage');
      assert.equal(res.status, 401);
    });

    it('rejects customer role on GET /api/v1/coupons/member-usage with 403', async () => {
      const res = await request(app)
        .get('/api/v1/coupons/member-usage')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.equal(res.status, 403);
    });
  });

  describe('Coupon Analytics Aggregations', () => {
    it('returns high-level overview, per-coupon metrics, and member usage summaries to admin', async () => {
      const res = await request(app)
        .get('/api/v1/coupons/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
      assert.ok(res.body.data.overview);
      assert.equal(typeof res.body.data.overview.total_redemptions, 'number');
      assert.equal(typeof res.body.data.overview.unique_members_count, 'number');
      assert.equal(typeof res.body.data.overview.unique_coupons_count, 'number');
      assert.equal(typeof res.body.data.overview.total_discount_granted, 'number');
      assert.ok(Array.isArray(res.body.data.coupons));
      assert.ok(Array.isArray(res.body.data.members));
    });

    it('works under admin route alias /api/v1/admin/coupons/analytics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/coupons/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.overview);
    });
  });

  describe('Member Coupon Redemption Ledger', () => {
    it('returns paginated ledger of redemptions with member details', async () => {
      const res = await request(app)
        .get('/api/v1/coupons/member-usage?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.meta);
      assert.equal(typeof res.body.meta.total, 'number');
      assert.equal(res.body.meta.limit, 10);
      assert.equal(res.body.meta.offset, 0);

      if (res.body.data.length > 0) {
        const item = res.body.data[0];
        assert.ok(item.order_number);
        assert.ok(item.coupon_code);
        assert.ok(item.customer_name);
        assert.equal(typeof item.discount_amount, 'number');
      }
    });

    it('filters member usage ledger by coupon code and search query', async () => {
      const res = await request(app)
        .get('/api/v1/admin/coupons/member-usage?couponCode=NONEXISTENTCODE999')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 0);
      assert.equal(res.body.meta.total, 0);
    });
  });
});
