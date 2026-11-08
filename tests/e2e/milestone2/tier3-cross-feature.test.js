const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../helpers/api-client');
const { getAdminToken } = require('../helpers/auth-helper');

describe('Tier 3: Cross-Feature Interactions & Lifecycle Integrity (Milestone 2)', () => {
  const adminToken = getAdminToken();
  const timestamp = Date.now();

  let categoryId = null;
  let categorySlug = null;
  let productId = null;
  let productSlug = null;

  describe('1. Category-to-Product Multi-Step Domain Lifecycle', () => {
    test('Step A: Create parent category for cross-feature flow', async () => {
      const res = await client.post(
        '/api/v1/categories',
        {
          name: `E2E Organic Tops ${timestamp}`,
          description: 'Parent category for cross-feature verification',
          is_active: 1,
        },
        { token: adminToken }
      );

      client.assertSuccessEnvelope(res, 201);
      categoryId = res.body.data.id;
      categorySlug = res.body.data.slug;
      assert.ok(categoryId, 'Category ID must be generated');
      assert.ok(categorySlug, 'Category slug must be generated');
    });

    test('Step B: Create product with multi-size/color variants linked to category', async () => {
      assert.ok(categoryId, 'Prerequisite: categoryId must be defined');

      const payload = {
        category_id: categoryId,
        name: `E2E Bamboo Longsleeve ${timestamp}`,
        short_description: 'Organic bamboo fiber longsleeve',
        description: 'Multi-variant lifecycle verification product.',
        base_price: 45.0,
        thumbnail_url: 'https://example.com/bamboo.jpg',
        is_featured: 0,
        is_active: 1,
        variants: [
          {
            sku: `BAMBOO-${timestamp}-OLV-S`,
            size: 'S',
            color: 'Olive',
            price: 45.0,
            compare_at_price: 55.0,
            stock_quantity: 20,
            is_active: 1,
          },
          {
            sku: `BAMBOO-${timestamp}-OLV-M`,
            size: 'M',
            color: 'Olive',
            price: 45.0,
            compare_at_price: 55.0,
            stock_quantity: 0, // Out of stock variant
            is_active: 1,
          },
          {
            sku: `BAMBOO-${timestamp}-WHT-L`,
            size: 'L',
            color: 'White',
            price: 50.0,
            compare_at_price: 60.0,
            stock_quantity: 15,
            is_active: 1,
          },
        ],
      };

      const res = await client.post('/api/v1/products', payload, { token: adminToken });

      client.assertSuccessEnvelope(res, 201);
      productId = res.body.data.id;
      productSlug = res.body.data.slug;
      assert.ok(productId, 'Product ID must be generated');
      assert.ok(productSlug, 'Product slug must be generated');
      assert.equal(res.body.data.variants.length, 3, 'Must create exactly 3 variants');
    });

    test('Step C: Query catalog filtered by category ID returns linked product', async () => {
      assert.ok(categoryId, 'Prerequisite: categoryId must be defined');
      const res = await client.get('/api/v1/products', { query: { category: categoryId } });

      client.assertSuccessEnvelope(res, 200);
      const items = res.body.data;
      const match = items.find((p) => p.id === productId);
      assert.ok(match, `Catalog filtered by category ${categoryId} must include created product`);
      assert.equal(match.name, `E2E Bamboo Longsleeve ${timestamp}`);
    });

    test('Step D: Query catalog with variant price filtering', async () => {
      // Filter within range 40 - 55 should match
      const resMatching = await client.get('/api/v1/products', {
        query: { minPrice: 40, maxPrice: 55, category: categoryId },
      });
      client.assertSuccessEnvelope(resMatching, 200);
      const match = resMatching.body.data.find((p) => p.id === productId);
      assert.ok(match, 'Product must be found within price range 40 - 55');

      // Filter above price range should NOT match
      const resOut = await client.get('/api/v1/products', {
        query: { minPrice: 100, maxPrice: 200, category: categoryId },
      });
      client.assertSuccessEnvelope(resOut, 200);
      const noMatch = resOut.body.data.find((p) => p.id === productId);
      assert.equal(noMatch, undefined, 'Product must not match out-of-range price filter');
    });

    test('Step E: Safe category deletion constraint when active products exist', async () => {
      assert.ok(categoryId, 'Prerequisite: categoryId must be defined');
      assert.ok(productId, 'Prerequisite: active product must be linked');

      const res = await client.delete(`/api/v1/categories/${categoryId}`, { token: adminToken });

      // The system should either:
      // 1. Prevent category deletion with 400/409 (Foreign key constraint defense)
      // 2. Or delete cleanly if cascade is configured
      // Crucially, it must NEVER crash with 500
      assert.notEqual(res.status, 500, 'Category deletion must not crash database connection');
    });

    test('Step F: Product deletion cleans up product and children variants atomically', async () => {
      assert.ok(productId, 'Prerequisite: productId must be defined');

      const delRes = await client.delete(`/api/v1/products/${productId}`, { token: adminToken });
      client.assertSuccessEnvelope(delRes, 200);

      // Verify product is gone
      const getRes = await client.get(`/api/v1/products/${productId}`);
      client.assertErrorEnvelope(getRes, 404);
    });

    test('Step G: Category cleanup after associated products are removed', async () => {
      if (!categoryId) return;
      const res = await client.delete(`/api/v1/categories/${categoryId}`, { token: adminToken });
      // Either 200 (if not deleted in Step E) or 404 (if already deleted in Step E)
      assert.ok(res.status === 200 || res.status === 404);
    });
  });

  describe('2. Atomic Transaction Rollback Integrity', () => {
    test('Product creation with one invalid variant must abort and leave no orphan rows', async () => {
      const uniqueName = `E2E Rollback Target ${timestamp}`;
      const payload = {
        name: uniqueName,
        base_price: 39.99,
        variants: [
          {
            sku: `VALID-${timestamp}-S`,
            size: 'S',
            color: 'Grey',
            price: 39.99,
            stock_quantity: 10,
          },
          {
            sku: `INVALID-${timestamp}-M`,
            size: 'M',
            color: 'Grey',
            price: -99.99, // Invalid price to trigger validation or DB constraint error
            stock_quantity: -10,
          },
        ],
      };

      const res = await client.post('/api/v1/products', payload, { token: adminToken });

      // Request must be rejected
      assert.ok(res.status === 422 || res.status === 400);

      // Verify that no orphan product was inserted in the database
      const checkRes = await client.get('/api/v1/products', { query: { search: uniqueName } });
      if (checkRes.status === 200 && Array.isArray(checkRes.body.data)) {
        const orphan = checkRes.body.data.find((p) => p.name === uniqueName);
        assert.equal(orphan, undefined, 'Orphan product must NOT exist after aborted transaction');
      }
    });
  });
});
