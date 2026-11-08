const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('../../backend/node_modules/supertest');
const app = require('../../backend/src/app');
const ProductModel = require('../../backend/src/models/product.model');
const { pool, checkDbHealth } = require('../../backend/src/config/db');
const { getAdminToken } = require('../../backend/tests/helpers/auth.helper');

describe('Empirical Adversarial Challenge Suite: Price Filtering, Rate Limiting & Variant Uniqueness', () => {
  const adminToken = getAdminToken();
  let isDbAvailable = false;

  before(async () => {
    try {
      const health = await checkDbHealth();
      isDbAvailable = Boolean(health && health.isConnected);
    } catch {
      isDbAvailable = false;
    }
  });

  // =========================================================================
  // SECTION 1: PRICE RANGE FILTERING ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('1. Price Range Filtering & Cross-Variant Boundary Checks', () => {
    let testProductId = null;
    const ts = Date.now();

    before(async () => {
      if (!isDbAvailable) return;
      // Create a test product with 3 active variants ($10, $50, $100)
      // and 1 inactive variant ($30)
      // Base price is set outside all target sub-ranges ($200.00)
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Adversarial Price Test Product ${ts}`,
          base_price: 200.0,
          variants: [
            { sku: `ADV-P10-${ts}`, size: 'S', color: 'Navy', price: 10.0, stock_quantity: 5, is_active: 1 },
            { sku: `ADV-P50-${ts}`, size: 'M', color: 'Navy', price: 50.0, stock_quantity: 5, is_active: 1 },
            { sku: `ADV-P100-${ts}`, size: 'L', color: 'Navy', price: 100.0, stock_quantity: 5, is_active: 1 },
            { sku: `ADV-P30-INACT-${ts}`, size: 'XL', color: 'Navy', price: 30.0, stock_quantity: 5, is_active: 0 },
          ],
        });

      assert.strictEqual(res.statusCode, 201, `Failed to setup test product: ${JSON.stringify(res.body)}`);
      testProductId = res.body.data.id;
    });

    after(async () => {
      if (testProductId) {
        await request(app)
          .delete(`/api/v1/products/${testProductId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });

    it('Gap bracket minPrice=20&maxPrice=40 excludes product (no active variant in range)', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=20&maxPrice=40&limit=50');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, false, 'Product must NOT match [20, 40] even though variants exist at 10 and 50');
    });

    it('Inactive variant price ($30) is NOT matched when querying minPrice=25&maxPrice=35', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=25&maxPrice=35&limit=50');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, false, 'Inactive variant at $30 must NOT cause product to match');
    });

    it('Exact boundary match minPrice=10&maxPrice=10 includes product', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=10&maxPrice=10&limit=50');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, true, 'Product must match exact boundary 10-10');
    });

    it('Exact boundary match minPrice=50&maxPrice=50 includes product', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=50&maxPrice=50&limit=50');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, true, 'Product must match exact boundary 50-50');
    });

    it('Upper gap bracket minPrice=60&maxPrice=90 excludes product', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=60&maxPrice=90&limit=50');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, false, 'Product must NOT match [60, 90]');
    });

    it('Direct Model findAll and countAll consistency check on price filter', async () => {
      if (!isDbAvailable) return;
      const [listExcluded, countExcluded] = await Promise.all([
        ProductModel.findAll({ minPrice: 20, maxPrice: 40, limit: 100 }),
        ProductModel.countAll({ minPrice: 20, maxPrice: 40 }),
      ]);
      assert.strictEqual(
        listExcluded.some((p) => p.id === testProductId),
        false
      );

      const [listIncluded, countIncluded] = await Promise.all([
        ProductModel.findAll({ minPrice: 45, maxPrice: 55, limit: 100 }),
        ProductModel.countAll({ minPrice: 45, maxPrice: 55 }),
      ]);
      assert.strictEqual(
        listIncluded.some((p) => p.id === testProductId),
        true
      );
      assert.ok(countIncluded >= 1, 'countAll must be >= 1 for matched range');
    });

    it('Malformed price strings (minPrice=abc, maxPrice=xyz) are safely ignored', async () => {
      const res = await request(app).get('/api/v1/products?minPrice=abc&maxPrice=xyz');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it('Inverted range minPrice=100&maxPrice=10 returns 0 matches for test product', async () => {
      assert.ok(testProductId);
      const res = await request(app).get('/api/v1/products?minPrice=100&maxPrice=10');
      assert.strictEqual(res.statusCode, 200);
      const matches = res.body.data.some((p) => p.id === testProductId);
      assert.strictEqual(matches, false, 'Inverted range must yield no false positive');
    });
  });

  // =========================================================================
  // SECTION 2: RATE LIMITING ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('2. Rate Limiting Enforcements & Immunity Verification', () => {
    it('authLimiter activates on rapid login attempts with x-test-rate-limit header', async () => {
      // Send 22 requests. Limit is 20.
      const responses = [];
      for (let i = 0; i < 22; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({ email: `burst_${i}@projecteco.com`, password: 'any' });
        responses.push(res.status);
      }

      const throttled = responses.filter((s) => s === 429);
      assert.ok(throttled.length >= 2, `Expected at least 2 throttled requests, got ${throttled.length}`);
    });

    it('searchLimiter activates on query parameter q as well as search', async () => {
      // searchLimiter limit is 60 req / min.
      // Send 63 rapid requests with ?q=organic
      const responses = [];
      for (let i = 0; i < 63; i++) {
        const res = await request(app)
          .get('/api/v1/products?q=organic')
          .set('x-test-rate-limit', 'true');
        responses.push(res.status);
      }

      const throttled = responses.filter((s) => s === 429);
      assert.ok(
        throttled.length >= 3,
        `Expected at least 3 throttled search requests for ?q=, got ${throttled.length}`
      );
    });

    it('Health endpoint /api/v1/health is immune to rate limits even under 60 rapid hits', async () => {
      const statuses = [];
      for (let i = 0; i < 60; i++) {
        const res = await request(app)
          .get('/api/v1/health')
          .set('x-test-rate-limit', 'true');
        statuses.push(res.status);
      }

      const throttled = statuses.filter((s) => s === 429);
      assert.strictEqual(throttled.length, 0, 'Health check must never be throttled by rate limiter');
    });
  });

  // =========================================================================
  // SECTION 3: VARIANT ATTRIBUTE UNIQUENESS ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('3. Variant Attribute Uniqueness & Collision Prevention', () => {
    const ts = Date.now();

    it('Rejects case-insensitive duplicate size/color at route level (422)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Case Collision Product ${ts}`,
          variants: [
            { sku: `COLL-1-${ts}`, size: 'large', color: 'NAVY', price: 29.99 },
            { sku: `COLL-2-${ts}`, size: 'LARGE', color: 'navy', price: 34.99 },
          ],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.errors.some(
          (e) => e.message && e.message.toLowerCase().includes('duplicate variant option combination')
        ),
        `Expected duplicate variant error, got: ${JSON.stringify(res.body.errors)}`
      );
    });

    it('Rejects whitespace-padded duplicate size/color at route level (422)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Whitespace Collision Product ${ts}`,
          variants: [
            { sku: `WS-1-${ts}`, size: '  M  ', color: ' Red ', price: 19.99 },
            { sku: `WS-2-${ts}`, size: 'M', color: 'Red', price: 21.99 },
          ],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.errors.some(
          (e) => e.message && e.message.toLowerCase().includes('duplicate variant option combination')
        )
      );
    });

    it('Rejects multiple variants with empty size and color at route level (422)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Empty Options Collision Product ${ts}`,
          variants: [
            { sku: `EMP-1-${ts}`, size: '', color: '', price: 15.0 },
            { sku: `EMP-2-${ts}`, size: ' ', color: ' ', price: 20.0 },
          ],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.errors.some(
          (e) =>
            e.message &&
            e.message.toLowerCase().includes('multiple variants cannot all have empty size and color')
        )
      );
    });

    it('Model level pre-check directly prevents duplicate (size, color) insertion', async () => {
      const variants = [
        { sku: `MDL-DUP-1-${ts}`, size: 'XL', color: 'Olive', price: 40.0 },
        { sku: `MDL-DUP-2-${ts}`, size: 'xl', color: 'olive', price: 45.0 },
      ];

      await assert.rejects(
        async () => {
          await ProductModel.create(
            { name: `Model Collision Test ${ts}`, slug: `mdl-col-${ts}`, base_price: 40.0 },
            variants
          );
        },
        /Duplicate variant option combination/i
      );
    });

    it('Single variant with empty size and color is permitted (simple product)', async () => {
      const skuSingle = `SIMPLE-PROD-${ts}`;
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Simple One-Variant Product ${ts}`,
          variants: [{ sku: skuSingle, size: '', color: '', price: 18.0, stock_quantity: 10 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const createdId = res.body.data.id;

      // Clean up
      await request(app)
        .delete(`/api/v1/products/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });
  });
});
