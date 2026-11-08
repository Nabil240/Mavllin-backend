const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('../../backend/node_modules/supertest');
const app = require('../../backend/src/app');
const { apiLimiter, authLimiter, searchLimiter } = require('../../backend/src/middlewares/rateLimit.middleware');
const { getAdminToken } = require('../../backend/tests/helpers/auth.helper');

describe('Adversarial Challenge: Rate Limiting Saturation & Boundary Defense', () => {
  const adminToken = getAdminToken();

  describe('1. Rate Limiter Routing & Threshold Verification', () => {
    const origTestRateLimit = process.env.TEST_RATE_LIMIT;

    before(() => {
      process.env.TEST_RATE_LIMIT = 'true';
    });

    after(() => {
      if (origTestRateLimit !== undefined) {
        process.env.TEST_RATE_LIMIT = origTestRateLimit;
      } else {
        delete process.env.TEST_RATE_LIMIT;
      }
    });

    it('Verify authLimiter is mounted on auth routes and throttles excess attempts', async () => {
      // Send 25 rapid requests to /api/v1/auth/login with invalid data.
      // authLimiter has max: 20 per 15min. Requests 1-20 proceed, requests 21-25 return HTTP 429.
      const responses = [];
      for (let i = 0; i < 25; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: `attacker${i}@example.com`, password: 'wrong' });
        responses.push(res.status);
      }

      // Check if requests exceeding 20 were throttled with 429
      const throttledCount = responses.filter((s) => s === 429).length;
      assert.strictEqual(
        throttledCount,
        5,
        `authLimiter successfully throttled 5 requests exceeding limit of 20 (got ${throttledCount})`
      );
    });

    it('Verify searchLimiter is mounted on product catalog search and throttles excess queries', async () => {
      // Send 65 rapid requests to GET /api/v1/products?search=hoodie.
      // searchLimiter has max: 60 per 1min. Requests 1-60 proceed, requests 61-65 return HTTP 429.
      const searchResponses = [];
      for (let i = 0; i < 65; i++) {
        const res = await request(app).get('/api/v1/products?search=hoodie');
        searchResponses.push(res.status);
      }

      const throttledSearchCount = searchResponses.filter((s) => s === 429).length;
      assert.strictEqual(
        throttledSearchCount,
        5,
        `searchLimiter successfully throttled 5 requests exceeding limit of 60 (got ${throttledSearchCount})`
      );
    });

    it('Verify Health Route Rate-Limit Immunity: /health and /api/v1/health are never throttled', async () => {
      // Tier 4 test in e2e fired requests to /api/v1/health assuming it tested rate limiting.
      // We empirically verify that /api/v1/health explicitly bypasses rate limiting by design.
      const healthStatuses = [];
      for (let i = 0; i < 50; i++) {
        const res = await request(app).get('/api/v1/health');
        healthStatuses.push(res.status);
      }

      const has429 = healthStatuses.includes(429);
      assert.strictEqual(has429, false, 'Health check must never return 429 (immune to rate limiting)');
    });
  });

  describe('2. Payload Size & Memory Exhaustion Defense', () => {
    it('Oversized JSON payload (>100kb limit) is safely rejected with 413 or 400', async () => {
      // In app.js: app.use(express.json({ limit: '100kb' }));
      // Generate 110 KB string to trigger body parser limit
      const hugeString = 'x'.repeat(110 * 1024);
      const hugePayload = {
        name: 'Huge Product',
        description: hugeString,
        variants: [{ sku: 'HUGE-1', price: 10.0 }],
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(hugePayload);

      // Must be rejected by Express (413 Payload Too Large or 400 Bad Request)
      assert.ok(
        res.status === 413 || res.status === 400,
        `Oversized payload must be rejected with 413 or 400, got ${res.status}`
      );
      assert.strictEqual(res.body.success, false, 'Error response must have success: false');
    });
  });

  describe('3. Unicode & Extreme Boundary Probing', () => {
    it('Rejects duplicate SKU within variants payload with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Adversarial Dup SKU',
          base_price: 50.0,
          variants: [
            { sku: 'DUP-ADV-1', size: 'S', color: 'Blue', price: 50.0, stock_quantity: 10 },
            { sku: 'DUP-ADV-1', size: 'M', color: 'Blue', price: 50.0, stock_quantity: 10 },
          ],
        });

      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.errors.some((e) => e.message && e.message.includes('Duplicate SKU')),
        'Must explicitly cite Duplicate SKU in validation errors'
      );
    });

    it('Rejects variant with price = 0 (price must be strictly positive)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zero Price Product',
          base_price: 0,
          variants: [
            { sku: 'ZERO-PRICE-1', size: 'S', color: 'Red', price: 0, stock_quantity: 5 },
          ],
        });

      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.errors.some((e) => e.field && e.field.includes('price')),
        'Must flag price <= 0 as validation error'
      );
    });

    it('Rejects empty or whitespace-only product name with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '    ',
          base_price: 30.0,
          variants: [
            { sku: 'BLANK-NAME-1', size: 'S', color: 'Red', price: 30.0, stock_quantity: 5 },
          ],
        });

      assert.strictEqual(res.status, 422);
      assert.strictEqual(res.body.success, false);
    });

    it('SQL injection attempt in route parameter safely handled without 500', async () => {
      const injectionParam = encodeURIComponent("1' OR '1'='1");
      const res = await request(app).get(`/api/v1/products/${injectionParam}`);
      // Must not crash with 500
      assert.notStrictEqual(res.status, 500, 'SQL injection must not trigger unhandled 500');
      // Should be 404 Not Found or 503 (if DB offline)
      assert.ok(res.status === 404 || res.status === 400 || res.status === 503);
    });
  });
});
