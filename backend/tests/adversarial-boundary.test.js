const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { getAdminToken, getCustomerToken, getExpiredAdminToken, getInvalidSecretToken } = require('./helpers/auth.helper');

describe('Milestone 2 Adversarial Boundary & Defense Tests', () => {
  let adminToken;
  let customerToken;
  let expiredToken;
  let invalidSecretToken;

  before(() => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();
    expiredToken = getExpiredAdminToken ? getExpiredAdminToken() : null;
    invalidSecretToken = getInvalidSecretToken ? getInvalidSecretToken() : null;
  });

  describe('1. Role-Based Access Control (RBAC) Defenses', () => {
    const adminRoutes = [
      { method: 'post', path: '/api/v1/categories', body: { name: 'Admin Cat' } },
      { method: 'put', path: '/api/v1/categories/1', body: { name: 'Admin Cat Update' } },
      { method: 'delete', path: '/api/v1/categories/1', body: {} },
      { method: 'post', path: '/api/v1/products', body: { name: 'Admin Prod' } },
      { method: 'put', path: '/api/v1/products/1', body: { name: 'Admin Prod Update' } },
      { method: 'delete', path: '/api/v1/products/1', body: {} },
      { method: 'delete', path: '/api/v1/products/images/1', body: {} },
    ];

    for (const route of adminRoutes) {
      it(`Rejects unauthenticated ${route.method.toUpperCase()} ${route.path} with 401`, async () => {
        const res = await request(app)[route.method](route.path).send(route.body);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Authentication') || res.body.message.includes('token'));
      });

      it(`Rejects customer role on ${route.method.toUpperCase()} ${route.path} with 403`, async () => {
        const res = await request(app)[route.method](route.path)
          .set('Authorization', `Bearer ${customerToken}`)
          .send(route.body);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Access denied') || res.body.message.includes('permission'));
      });

      it(`Rejects invalid/malformed bearer token on ${route.method.toUpperCase()} ${route.path} with 401`, async () => {
        const res = await request(app)[route.method](route.path)
          .set('Authorization', 'Bearer invalid.jwt.token.here')
          .send(route.body);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
      });
    }
  });

  describe('2. Malformed JSON Body Defenses', () => {
    const endpoints = [
      { method: 'post', path: '/api/v1/categories' },
      { method: 'post', path: '/api/v1/products' },
      { method: 'put', path: '/api/v1/categories/1' },
      { method: 'put', path: '/api/v1/products/1' },
    ];

    for (const ep of endpoints) {
      it(`Handles malformed JSON body on ${ep.method.toUpperCase()} ${ep.path} with 400 Bad Request`, async () => {
        const res = await request(app)[ep.method](ep.path)
          .set('Content-Type', 'application/json')
          .set('Authorization', `Bearer ${adminToken}`)
          .send('{"bad_json_raw: ');

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('Malformed JSON payload'));
      });
    }
  });

  describe('3. Negative Price and Stock Number Defenses', () => {
    it('Rejects negative base_price on product creation with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Base Price Product',
          base_price: -19.99,
          variants: [{ sku: 'TEST-NEG-BP-1', price: 19.99, stock_quantity: 10 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field === 'base_price'));
    });

    it('Rejects negative discount_price on product creation with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Discount Product',
          base_price: 29.99,
          discount_price: -5.0,
          variants: [{ sku: 'TEST-NEG-DP-1', price: 29.99, stock_quantity: 10 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field === 'discount_price'));
    });

    it('Rejects zero variant price (price <= 0) with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zero Price Variant Product',
          base_price: 10.0,
          variants: [{ sku: 'TEST-ZERO-P-1', price: 0, stock_quantity: 10 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('price')));
    });

    it('Rejects negative variant price (price < 0) with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Price Variant Product',
          base_price: 10.0,
          variants: [{ sku: 'TEST-NEG-P-1', price: -15.5, stock_quantity: 10 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('price')));
    });

    it('Rejects negative compare_at_price on variant with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Compare Price Product',
          base_price: 20.0,
          variants: [{ sku: 'TEST-NEG-CMP-1', price: 20.0, compare_at_price: -10.0, stock_quantity: 5 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('compare_at_price')));
    });

    it('Rejects negative stock_quantity on variant with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Stock Product',
          base_price: 20.0,
          variants: [{ sku: 'TEST-NEG-STK-1', price: 20.0, stock_quantity: -1 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('stock_quantity')));
    });

    it('Rejects negative camelCase stockQuantity on variant with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Stock CamelCase Product',
          base_price: 20.0,
          variants: [{ sku: 'TEST-NEG-STK-2', price: 20.0, stockQuantity: -8 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('stockQuantity')));
    });

    it('Rejects non-integer variant stock_quantity (float) with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Float Stock Product',
          base_price: 20.0,
          variants: [{ sku: 'TEST-FLOAT-STK', price: 20.0, stock_quantity: 3.5 }],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.field && e.field.includes('stock_quantity')));
    });
  });

  describe('4. Duplicate Variant Defenses', () => {
    it('Rejects duplicate SKU within same product payload with 422', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate SKU Product',
          base_price: 25.0,
          variants: [
            { sku: 'DUP-SKU-COMMON', size: 'S', color: 'Blue', price: 25.0, stock_quantity: 5 },
            { sku: 'DUP-SKU-COMMON', size: 'M', color: 'Red', price: 25.0, stock_quantity: 10 },
          ],
        });

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.errors.some((e) => e.message && e.message.includes('Duplicate SKU')));
    });

    it('Examines duplicate (size, color) variant combination within same payload', async () => {
      // Different SKUs but identical variant combination (size=M, color=Blue)
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Combination Product',
          base_price: 25.0,
          variants: [
            { sku: 'COMB-SKU-1', size: 'M', color: 'Blue', price: 25.0, stock_quantity: 5 },
            { sku: 'COMB-SKU-2', size: 'M', color: 'Blue', price: 25.0, stock_quantity: 10 },
          ],
        });

      // Observe if caught at input validation (422) or if it passes to DB
      // When database is disconnected, if it passed input validation it returns 503 or 409
      const caughtAtValidation = res.statusCode === 422;
      console.log(`[OBSERVATION] Duplicate (size, color) validation status: ${res.statusCode}`);
      if (!caughtAtValidation) {
        console.log('[DEFENSE GAP] Duplicate (size, color) variant combinations are NOT rejected by express-validator at the API boundary!');
      }
    });
  });

  describe('5. SQL Injection & Path Traversal Adversarial Probes', () => {
    const sqliFilters = [
      { param: 'categoryId', value: "1' OR '1'='1" },
      { param: 'minPrice', value: '10; DROP TABLE products;--' },
      { param: 'maxPrice', value: "100' OR 1=1--" },
      { param: 'sort', value: 'price_asc; DROP TABLE products;--' },
      { param: 'inStock', value: "true' OR '1'='1" },
      { param: 'search', value: "tshirt' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20--" },
    ];

    for (const probe of sqliFilters) {
      it(`Neutralizes SQL injection in query parameter ${probe.param} safely without 500 crash`, async () => {
        const res = await request(app)
          .get(`/api/v1/products?${probe.param}=${encodeURIComponent(probe.value)}`);

        // SQL injection attempt must NEVER cause an unhandled 500 error or syntax error leak
        assert.notStrictEqual(res.statusCode, 500);
        // Valid status codes: 200 (filtered/neutralized), 400/422 (rejected), or 503 (DB down)
        assert.ok([200, 400, 422, 503].includes(res.statusCode));
        const rawBody = JSON.stringify(res.body);
        assert.ok(!rawBody.toLowerCase().includes('sql syntax'));
        assert.ok(!rawBody.includes('mysql2'));
      });
    }

    it('Neutralizes SQL injection in route identifier (/api/v1/products/:idOrSlug) without 500', async () => {
      const res = await request(app)
        .get("/api/v1/products/1'%20OR%20'1'='1");

      assert.notStrictEqual(res.statusCode, 500);
      assert.ok([404, 400, 422, 503].includes(res.statusCode));
      const rawBody = JSON.stringify(res.body);
      assert.ok(!rawBody.toLowerCase().includes('sql syntax'));
    });

    it('Neutralizes path traversal attempt in category identifier without 500', async () => {
      const res = await request(app).get('/api/v1/categories/../../../../etc/passwd');
      assert.notStrictEqual(res.statusCode, 500);
      assert.ok([404, 400, 422, 503].includes(res.statusCode));
    });
  });

  describe('6. XSS Payloads in Input Probes', () => {
    it('Examines XSS payload handling in product name and description', async () => {
      const xssPayload = {
        name: '<script>alert("xss")</script> Cotton Shirt',
        short_description: '<img src=x onerror=alert("xss")>',
        description: '<p>Standard description <svg onload=alert(1)></p>',
        base_price: 29.99,
        variants: [{ sku: 'XSS-TEST-SKU-1', price: 29.99, stock_quantity: 10 }],
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(xssPayload);

      // Must not crash with 500
      assert.notStrictEqual(res.statusCode, 500);
      console.log(`[OBSERVATION] XSS payload response status: ${res.statusCode}`);
      // If DB is disconnected, returns 503 (which means it passed validator without sanitizing/rejecting script tags)
      if (res.statusCode === 503) {
        console.log('[OBSERVATION] Raw HTML/XSS script tags passed express-validator without rejection or input-time sanitization.');
      }
    });
  });

  describe('7. Health Endpoint Failure Mode (Database Unavailable)', () => {
    const db = require('../src/config/db');
    let origCheck;

    before(() => {
      origCheck = db.checkDbHealth;
      db.checkDbHealth = async () => ({ isConnected: false, error: 'Database connection failed' });
    });

    after(() => {
      db.checkDbHealth = origCheck;
    });

    it('GET /api/v1/health returns 503 Degraded when database connection fails', async () => {
      const res = await request(app).get('/api/v1/health');

      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.status, 'degraded');
      assert.strictEqual(res.body.service, 'mavllin-api');
      assert.ok(res.body.timestamp);
      assert.strictEqual(res.body.database.status, 'disconnected');
      assert.ok(res.body.database.error);
    });

    it('GET /health root alias returns identical 503 Degraded contract', async () => {
      const res = await request(app).get('/health');

      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.status, 'degraded');
      assert.strictEqual(res.body.database.status, 'disconnected');
    });
  });
});
