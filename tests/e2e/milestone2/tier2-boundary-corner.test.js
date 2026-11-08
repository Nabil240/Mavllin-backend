const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../helpers/api-client');
const {
  getAdminToken,
  getCustomerToken,
  getExpiredAdminToken,
  getInvalidSecretToken,
} = require('../helpers/auth-helper');

describe('Tier 2: Boundary & Corner Cases (Milestone 2 Opaque-Box E2E)', () => {
  const adminToken = getAdminToken();
  const customerToken = getCustomerToken();
  const expiredAdminToken = getExpiredAdminToken();
  const invalidSecretToken = getInvalidSecretToken();
  const timestamp = Date.now();

  describe('1. Standard Error Envelope & Routing Boundaries', () => {
    test('Non-existent route should return 404 with standard error envelope', async () => {
      const res = await client.get('/api/v1/non-existent-resource-endpoint');

      client.assertErrorEnvelope(res, 404);
      assert.ok(
        res.body.message.toLowerCase().includes('not found') ||
          res.body.message.toLowerCase().includes('cannot'),
        `Message should indicate route not found: "${res.body.message}"`
      );
    });

    test('Malformed JSON body should return 400 Bad Request with error envelope', async () => {
      const res = await client.request('POST', '/api/v1/categories', {
        body: '{"invalidJson": unquoted_value}',
        headers: { 'Content-Type': 'application/json' },
        token: adminToken,
      });

      // Express body-parser rejects invalid JSON with HTTP 400
      client.assertErrorEnvelope(res, 400);
    });

    test('Error responses should not leak stack traces or database connection details', async () => {
      const res = await client.get('/api/v1/categories/invalid-id-query?id[]=malformed');
      client.assertErrorEnvelope(res);

      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes('node_modules'), 'Must not leak file system paths');
      assert.ok(!raw.includes('DB_PASSWORD'), 'Must not leak DB credentials');
      assert.ok(!raw.includes('mysql2/promise'), 'Must not leak internal library frames');
    });
  });

  describe('2. Authentication & Authorization Boundaries', () => {
    test('POST /api/v1/categories without token should return 401 Unauthorized', async () => {
      const res = await client.post('/api/v1/categories', { name: 'Unauthorized Category' });
      client.assertErrorEnvelope(res, 401);
    });

    test('POST /api/v1/categories with customer token should return 403 Forbidden', async () => {
      const res = await client.post(
        '/api/v1/categories',
        { name: 'Forbidden Category' },
        { token: customerToken }
      );
      client.assertErrorEnvelope(res, 403);
    });

    test('POST /api/v1/categories with expired token should return 401 Unauthorized', async () => {
      const res = await client.post(
        '/api/v1/categories',
        { name: 'Expired Token Category' },
        { token: expiredAdminToken }
      );
      client.assertErrorEnvelope(res, 401);
    });

    test('POST /api/v1/categories with invalid signature token should return 401 Unauthorized', async () => {
      const res = await client.post(
        '/api/v1/categories',
        { name: 'Tampered Token Category' },
        { token: invalidSecretToken }
      );
      client.assertErrorEnvelope(res, 401);
    });

    test('POST /api/v1/products without admin authorization should return 401/403', async () => {
      const res = await client.post('/api/v1/products', { name: 'Unauthorized Product' });
      assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403, got ${res.status}`);
      client.assertErrorEnvelope(res);
    });
  });

  describe('3. Category Input Validation & Boundary Conditions', () => {
    test('POST /api/v1/categories with missing name should return 422 validation error', async () => {
      const res = await client.post('/api/v1/categories', {}, { token: adminToken });
      client.assertValidationError(res, 'name');
    });

    test('POST /api/v1/categories with empty/whitespace name should return 422', async () => {
      const res = await client.post(
        '/api/v1/categories',
        { name: '     ' },
        { token: adminToken }
      );
      client.assertValidationError(res, 'name');
    });

    test('POST /api/v1/categories with non-integer parent_id should return 422', async () => {
      const res = await client.post(
        '/api/v1/categories',
        { name: `Subcategory ${timestamp}`, parent_id: 'not-an-integer' },
        { token: adminToken }
      );
      client.assertValidationError(res, 'parent_id');
    });

    test('GET /api/v1/categories/:id with non-existent ID should return 404', async () => {
      const res = await client.get('/api/v1/categories/99999999');
      client.assertErrorEnvelope(res, 404);
    });

    test('GET /api/v1/categories/:slug with non-existent slug should return 404', async () => {
      const res = await client.get('/api/v1/categories/non-existent-category-slug-99999');
      client.assertErrorEnvelope(res, 404);
    });
  });

  describe('4. Product & Variant Validation & Boundary Conditions', () => {
    test('POST /api/v1/products with missing name should return 422', async () => {
      const payload = {
        base_price: 35.0,
        variants: [
          { sku: `TEST-${timestamp}-1`, size: 'M', color: 'White', price: 35.0, stock_quantity: 10 },
        ],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      client.assertValidationError(res, 'name');
    });

    test('POST /api/v1/products with empty variants array should return 422', async () => {
      const payload = {
        name: `Empty Variants Product ${timestamp}`,
        base_price: 35.0,
        variants: [],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      client.assertValidationError(res, 'variants');
    });

    test('POST /api/v1/products with negative variant price should return 422', async () => {
      const payload = {
        name: `Negative Price Product ${timestamp}`,
        base_price: 35.0,
        variants: [
          { sku: `NEG-PRICE-${timestamp}`, size: 'M', color: 'Red', price: -15.0, stock_quantity: 10 },
        ],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      client.assertErrorEnvelope(res, 422);
    });

    test('POST /api/v1/products with negative variant stock quantity should return 422', async () => {
      const payload = {
        name: `Negative Stock Product ${timestamp}`,
        base_price: 35.0,
        variants: [
          { sku: `NEG-STOCK-${timestamp}`, size: 'M', color: 'Blue', price: 25.0, stock_quantity: -5 },
        ],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      client.assertErrorEnvelope(res, 422);
    });

    test('POST /api/v1/products with missing variant SKU should return 422', async () => {
      const payload = {
        name: `Missing SKU Product ${timestamp}`,
        base_price: 35.0,
        variants: [
          { size: 'M', color: 'Green', price: 25.0, stock_quantity: 10 },
        ],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      client.assertErrorEnvelope(res, 422);
    });

    test('POST /api/v1/products with duplicate SKUs in same payload should reject with 400 or 422', async () => {
      const duplicateSku = `DUP-SKU-${timestamp}`;
      const payload = {
        name: `Duplicate SKU Product ${timestamp}`,
        base_price: 30.0,
        variants: [
          { sku: duplicateSku, size: 'M', color: 'Black', price: 30.0, stock_quantity: 10 },
          { sku: duplicateSku, size: 'L', color: 'Black', price: 30.0, stock_quantity: 10 },
        ],
      };
      const res = await client.post('/api/v1/products', payload, { token: adminToken });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Duplicate SKU must be rejected with 400 or 422, got ${res.status}`
      );
      client.assertErrorEnvelope(res);
    });

    test('GET /api/v1/products/:identifier with non-existent ID should return 404', async () => {
      const res = await client.get('/api/v1/products/99999999');
      client.assertErrorEnvelope(res, 404);
    });

    test('GET /api/v1/products/:identifier with non-existent slug should return 404', async () => {
      const res = await client.get('/api/v1/products/non-existent-product-slug-xyz');
      client.assertErrorEnvelope(res, 404);
    });
  });

  describe('5. Adversarial Input & Injection Probes', () => {
    test('SQL injection probe in catalog filter query parameter should not trigger SQL syntax error', async () => {
      const res = await client.get('/api/v1/products', {
        query: { category: "' OR '1'='1", minPrice: '0; DROP TABLE products;--' },
      });

      // Should either return empty/filtered results or validation error (422/400), NEVER 500
      assert.notEqual(res.status, 500, 'SQL injection probe must never cause unhandled 500 server crash');
      if (res.status === 200) {
        client.assertSuccessEnvelope(res, 200);
      } else {
        client.assertErrorEnvelope(res);
      }
    });

    test('SQL injection in product route parameter should safely return 404 or 422', async () => {
      const res = await client.get("/api/v1/products/1' UNION SELECT 1,2,3,4,5,6,7,8--");
      assert.notEqual(res.status, 500, 'Route param SQL injection must never crash with 500');
      assert.ok(res.status === 404 || res.status === 422 || res.status === 400);
    });

    test('Non-ASCII apparel name (Bengali characters) should be handled correctly', async () => {
      const bengaliPayload = {
        name: `সুতি পাঞ্জাবি ${timestamp}`,
        description: 'Sustainable handloom cotton panjabi',
        is_active: 1,
      };

      const res = await client.post('/api/v1/categories', bengaliPayload, { token: adminToken });
      if (res.status === 201) {
        client.assertSuccessEnvelope(res, 201);
        assert.ok(res.body.data.id);
        // Clean up
        await client.delete(`/api/v1/categories/${res.body.data.id}`, { token: adminToken });
      } else {
        // If system rejects non-ascii, must return structured error envelope
        client.assertErrorEnvelope(res);
      }
    });
  });
});
