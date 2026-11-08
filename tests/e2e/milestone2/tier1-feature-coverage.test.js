const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../helpers/api-client');
const { getAdminToken } = require('../helpers/auth-helper');

describe('Tier 1: Feature Coverage (Milestone 2 Opaque-Box E2E)', () => {
  const adminToken = getAdminToken();
  const timestamp = Date.now();
  let createdCategoryId = null;
  let createdCategorySlug = null;
  let createdProductId = null;
  let createdProductSlug = null;

  describe('1. Health & Express Foundation Contracts', () => {
    test('GET /api/v1/health should return 200 with active service and database status', async () => {
      const res = await client.get('/api/v1/health');

      assert.equal(res.status, 200, `Health check failed with status ${res.status}: ${res.rawText}`);
      assert.ok(res.body, 'Response body must not be null');
      assert.equal(res.body.status, 'ok', 'Status must be "ok"');
      assert.equal(res.body.service, 'project-eco-api', 'Service name must be "project-eco-api"');
      assert.ok(res.body.timestamp, 'Timestamp must be present');
      assert.ok(res.body.database, 'Database health section must be present');
      assert.equal(res.body.database.status, 'connected', 'Database status must be "connected"');
    });

    test('HTTP responses must include Helmet security headers', async () => {
      const res = await client.get('/api/v1/health');
      client.assertSecurityHeaders(res);
    });
  });

  describe('2. Category Management APIs', () => {
    test('GET /api/v1/categories should return 200 with category list', async () => {
      const res = await client.get('/api/v1/categories');

      client.assertSuccessEnvelope(res, 200);
      assert.ok(Array.isArray(res.body.data), 'Data field must be an array of categories');
    });

    test('POST /api/v1/categories (Admin) should create a new category with generated slug', async () => {
      const payload = {
        name: `E2E Apparel ${timestamp}`,
        description: 'Automated test apparel category',
        is_active: 1,
      };

      const res = await client.post('/api/v1/categories', payload, { token: adminToken });

      client.assertSuccessEnvelope(res, 201);
      assert.ok(res.body.data, 'Created category data must not be empty');
      assert.ok(res.body.data.id, 'Category must have an id');
      assert.equal(res.body.data.name, payload.name);
      assert.ok(res.body.data.slug, 'Category must have a generated slug');

      createdCategoryId = res.body.data.id;
      createdCategorySlug = res.body.data.slug;
    });

    test('GET /api/v1/categories/:identifier should retrieve category by numeric ID', async () => {
      assert.ok(createdCategoryId, 'Prerequisite: createdCategoryId must be set');
      const res = await client.get(`/api/v1/categories/${createdCategoryId}`);

      client.assertSuccessEnvelope(res, 200);
      assert.equal(res.body.data.id, createdCategoryId);
      assert.equal(res.body.data.slug, createdCategorySlug);
    });

    test('GET /api/v1/categories/:identifier should retrieve category by slug', async () => {
      assert.ok(createdCategorySlug, 'Prerequisite: createdCategorySlug must be set');
      const res = await client.get(`/api/v1/categories/${createdCategorySlug}`);

      client.assertSuccessEnvelope(res, 200);
      assert.equal(res.body.data.id, createdCategoryId);
      assert.equal(res.body.data.slug, createdCategorySlug);
    });

    test('PUT /api/v1/categories/:id (Admin) should update category details', async () => {
      assert.ok(createdCategoryId, 'Prerequisite: createdCategoryId must be set');
      const updatedName = `E2E Apparel Updated ${timestamp}`;
      const res = await client.put(
        `/api/v1/categories/${createdCategoryId}`,
        { name: updatedName, description: 'Updated description' },
        { token: adminToken }
      );

      client.assertSuccessEnvelope(res, 200);
      assert.equal(res.body.data.name, updatedName);
    });
  });

  describe('3. Product Catalog & Variant APIs', () => {
    test('POST /api/v1/products (Admin) should create product with multiple variants atomically', async () => {
      assert.ok(createdCategoryId, 'Prerequisite: createdCategoryId must exist');

      const productPayload = {
        category_id: createdCategoryId,
        name: `E2E Eco Hoodie ${timestamp}`,
        short_description: 'Organic cotton hoodie',
        description: 'Sustainable heavy cotton fleece hoodie for e2e tests.',
        base_price: 59.99,
        thumbnail_url: 'https://example.com/images/e2e-hoodie.jpg',
        is_featured: 1,
        is_active: 1,
        variants: [
          {
            sku: `HOODIE-${timestamp}-BLK-M`,
            size: 'M',
            color: 'Black',
            price: 59.99,
            compare_at_price: 79.99,
            stock_quantity: 40,
            is_active: 1,
          },
          {
            sku: `HOODIE-${timestamp}-BLK-L`,
            size: 'L',
            color: 'Black',
            price: 59.99,
            compare_at_price: 79.99,
            stock_quantity: 25,
            is_active: 1,
          },
          {
            sku: `HOODIE-${timestamp}-NAVY-XL`,
            size: 'XL',
            color: 'Navy',
            price: 64.99,
            compare_at_price: null,
            stock_quantity: 15,
            is_active: 1,
          },
        ],
      };

      const res = await client.post('/api/v1/products', productPayload, { token: adminToken });

      client.assertSuccessEnvelope(res, 201);
      assert.ok(res.body.data, 'Product data must be returned');
      assert.ok(res.body.data.id, 'Product must have an id');
      assert.equal(res.body.data.name, productPayload.name);
      assert.ok(res.body.data.slug, 'Product must have a generated slug');

      // Check variants array in response
      const variants = res.body.data.variants;
      assert.ok(Array.isArray(variants), 'Created product response must include variants array');
      assert.equal(variants.length, 3, 'All 3 variants must be created');

      const skus = variants.map((v) => v.sku);
      assert.ok(skus.includes(`HOODIE-${timestamp}-BLK-M`));
      assert.ok(skus.includes(`HOODIE-${timestamp}-BLK-L`));
      assert.ok(skus.includes(`HOODIE-${timestamp}-NAVY-XL`));

      createdProductId = res.body.data.id;
      createdProductSlug = res.body.data.slug;
    });

    test('GET /api/v1/products should return paginated catalog with variants', async () => {
      const res = await client.get('/api/v1/products', { query: { page: 1, limit: 10 } });

      client.assertSuccessEnvelope(res, 200);
      assert.ok(Array.isArray(res.body.data), 'Products data must be an array');
      assert.ok(res.body.meta, 'Pagination metadata must be included in meta envelope');
      assert.equal(typeof res.body.meta.page, 'number');
      assert.equal(typeof res.body.meta.limit, 'number');
      assert.equal(typeof res.body.meta.total, 'number');

      // Verify that items include variant arrays or variant summaries
      const foundProduct = res.body.data.find((p) => p.id === createdProductId || p.slug === createdProductSlug);
      if (foundProduct) {
        assert.ok(Array.isArray(foundProduct.variants), 'Products in listing should provide variants array');
      }
    });

    test('GET /api/v1/products/:idOrSlug should return product detail with active variants by ID', async () => {
      assert.ok(createdProductId, 'Prerequisite: createdProductId must exist');
      const res = await client.get(`/api/v1/products/${createdProductId}`);

      client.assertSuccessEnvelope(res, 200);
      const product = res.body.data;
      assert.equal(product.id, createdProductId);
      assert.ok(Array.isArray(product.variants), 'Product detail must include variants array');
      assert.equal(product.variants.length, 3, 'Product must contain 3 variants');

      const sampleVariant = product.variants[0];
      assert.ok(sampleVariant.sku, 'Variant must have SKU');
      assert.ok(sampleVariant.size, 'Variant must have size');
      assert.ok(sampleVariant.color, 'Variant must have color');
      assert.ok(Number(sampleVariant.price) > 0, 'Variant price must be positive number');
      assert.ok(
        (sampleVariant.stock_quantity ?? sampleVariant.stockQuantity) >= 0,
        'Variant stock must be non-negative'
      );
    });

    test('GET /api/v1/products/:idOrSlug should return product detail with active variants by Slug', async () => {
      assert.ok(createdProductSlug, 'Prerequisite: createdProductSlug must exist');
      const res = await client.get(`/api/v1/products/${createdProductSlug}`);

      client.assertSuccessEnvelope(res, 200);
      assert.equal(res.body.data.id, createdProductId);
      assert.equal(res.body.data.slug, createdProductSlug);
    });

    test('GET /api/v1/products/featured should return featured products collection', async () => {
      const res = await client.get('/api/v1/products/featured');
      client.assertSuccessEnvelope(res, 200);
      assert.ok(Array.isArray(res.body.data), 'Featured products must be an array');
    });
  });

  describe('4. Teardown / Cleanup', () => {
    test('DELETE /api/v1/products/:id should remove product and variants', async () => {
      if (!createdProductId) return;
      const res = await client.delete(`/api/v1/products/${createdProductId}`, { token: adminToken });
      client.assertSuccessEnvelope(res, 200);
    });

    test('DELETE /api/v1/categories/:id should remove category', async () => {
      if (!createdCategoryId) return;
      const res = await client.delete(`/api/v1/categories/${createdCategoryId}`, { token: adminToken });
      client.assertSuccessEnvelope(res, 200);
    });
  });
});
