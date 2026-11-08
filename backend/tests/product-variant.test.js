const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { getAdminToken } = require('./helpers/auth.helper');

describe('Product & Product Variant APIs', () => {
  let adminToken;
  let createdProductId;
  let createdProductSlug;
  const uniqueTimestamp = Date.now();
  const testProductName = `Organic Eco Hoodie ${uniqueTimestamp}`;
  const testSkuS = `TEST-HD-${uniqueTimestamp}-S`;
  const testSkuM = `TEST-HD-${uniqueTimestamp}-M`;

  before(() => {
    adminToken = getAdminToken();
  });

  it('GET /api/v1/products returns paginated list with variant arrays', async () => {
    const res = await request(app).get('/api/v1/products?limit=5');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    if (res.body.data.length > 0) {
      assert.ok(Array.isArray(res.body.data[0].variants));
    }
  });

  it('POST /api/v1/products rejects creation without variants array with 422', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Variant-less Product',
        base_price: 49.99,
      });

    assert.strictEqual(res.statusCode, 422);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.field === 'variants'));
  });

  it('POST /api/v1/products rejects variant with negative stock with 422', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Stock Product',
        base_price: 29.99,
        variants: [
          { sku: `BAD-STOCK-${uniqueTimestamp}`, price: 29.99, stock_quantity: -5 },
        ],
      });

    assert.strictEqual(res.statusCode, 422);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.field && e.field.includes('stock_quantity')));
  });

  it('POST /api/v1/products rejects variant with negative price with 422', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Price Product',
        base_price: 25.0,
        variants: [
          { sku: `BAD-PRICE-${uniqueTimestamp}`, price: -10.0, stock_quantity: 10 },
        ],
      });

    assert.strictEqual(res.statusCode, 422);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.field && e.field.includes('price')));
  });

  it('POST /api/v1/products rejects within-request duplicate SKUs with 422', async () => {
    const duplicateSku = `DUP-SKU-${uniqueTimestamp}`;
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate SKU Product',
        base_price: 25.0,
        variants: [
          { sku: duplicateSku, size: 'S', color: 'Black', price: 25.0, stock_quantity: 10 },
          { sku: duplicateSku, size: 'M', color: 'Black', price: 25.0, stock_quantity: 10 },
        ],
      });

    assert.strictEqual(res.statusCode, 422);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.errors.some((e) => e.message && e.message.includes('Duplicate SKU')));
  });

  it('POST /api/v1/products successfully creates product with multiple variants atomically (201)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: testProductName,
        short_description: 'Comfortable organic cotton hoodie.',
        description: 'Designed for everyday warmth and minimal environmental impact.',
        base_price: 59.99,
        is_featured: 1,
        is_active: 1,
        variants: [
          {
            sku: testSkuS,
            size: 'S',
            color: 'Black',
            price: 59.99,
            compare_at_price: 69.99,
            stock_quantity: 20,
            is_active: 1,
          },
          {
            sku: testSkuM,
            size: 'M',
            color: 'Black',
            price: 59.99,
            compare_at_price: 69.99,
            stock_quantity: 35,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.ok(res.body.data.slug);
    assert.strictEqual(res.body.data.name, testProductName);
    assert.strictEqual(res.body.data.variants.length, 2);
    assert.strictEqual(res.body.data.variants[0].sku, testSkuS);
    assert.strictEqual(res.body.data.variants[1].sku, testSkuM);

    createdProductId = res.body.data.id;
    createdProductSlug = res.body.data.slug;
  });

  it('GET /api/v1/products/:identifier fetches product with variants by slug', async () => {
    assert.ok(createdProductSlug);
    const res = await request(app).get(`/api/v1/products/${createdProductSlug}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, createdProductId);
    assert.strictEqual(res.body.data.variants.length, 2);
    assert.strictEqual(res.body.data.total_stock, 55);
    assert.ok(res.body.data.available_sizes.includes('S'));
    assert.ok(res.body.data.available_sizes.includes('M'));
    assert.ok(res.body.data.available_colors.includes('Black'));
  });

  it('GET /api/v1/products?size=S filters catalog by variant size', async () => {
    assert.ok(createdProductId);
    const res = await request(app).get('/api/v1/products?size=S');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.some((p) => p.id === createdProductId));
  });

  it('GET /api/v1/products?color=Black filters catalog by variant color', async () => {
    assert.ok(createdProductId);
    const res = await request(app).get('/api/v1/products?color=Black');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.some((p) => p.id === createdProductId));
  });

  it('GET /api/v1/products?inStock=true returns products having available variant stock', async () => {
    assert.ok(createdProductId);
    const res = await request(app).get('/api/v1/products?inStock=true');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.data.some((p) => p.id === createdProductId));
  });

  describe('Regression: Multi-Variant Price Range Query Filtering', () => {
    let multiPriceProductId;
    const multiPriceTimestamp = Date.now() + 1;
    const multiPriceName = `Disparate Variant Price Product ${multiPriceTimestamp}`;
    const skuLow = `PRICE-LOW-${multiPriceTimestamp}`;
    const skuHigh = `PRICE-HIGH-${multiPriceTimestamp}`;

    before(async () => {
      // Create product with base_price = 199.99 (outside [50, 80]),
      // Variant 1 priced at $25.00 (below 50),
      // Variant 2 priced at $150.00 (above 80).
      // Crucially, NO variant (nor base_price) has price in range [50, 80]!
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: multiPriceName,
          base_price: 199.99,
          variants: [
            { sku: skuLow, size: 'S', color: 'Teal', price: 25.0, stock_quantity: 10, is_active: 1 },
            { sku: skuHigh, size: 'XL', color: 'Teal', price: 150.0, stock_quantity: 10, is_active: 1 },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      multiPriceProductId = res.body.data.id;
    });

    it('GET /api/v1/products?minPrice=50&maxPrice=80 excludes product when no single variant falls within range (prevents cross-variant false positive)', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?minPrice=50&maxPrice=80');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const isMatched = res.body.data.some((p) => p.id === multiPriceProductId);
      assert.strictEqual(
        isMatched,
        false,
        `Regression failure: Product ${multiPriceProductId} was matched for range $50-$80, but its variants are $25 and $150 (cross-variant false positive!)`
      );
    });

    it('GET /api/v1/products?minPrice=20&maxPrice=30 includes product matching low variant ($25)', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?minPrice=20&maxPrice=30');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const isMatched = res.body.data.some((p) => p.id === multiPriceProductId);
      assert.strictEqual(
        isMatched,
        true,
        `Product ${multiPriceProductId} with $25 variant should match price range $20-$30`
      );
    });

    it('GET /api/v1/products?minPrice=140&maxPrice=160 includes product matching high variant ($150)', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?minPrice=140&maxPrice=160');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const isMatched = res.body.data.some((p) => p.id === multiPriceProductId);
      assert.strictEqual(
        isMatched,
        true,
        `Product ${multiPriceProductId} with $150 variant should match price range $140-$160`
      );
    });

    it('GET /api/v1/products?minPrice=20&maxPrice=200 includes product spanning both variants', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?minPrice=20&maxPrice=200');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const isMatched = res.body.data.some((p) => p.id === multiPriceProductId);
      assert.strictEqual(isMatched, true);
    });

    it('GET /api/v1/products?minPrice=140 filters correctly with single minPrice bound', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?minPrice=140');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.some((p) => p.id === multiPriceProductId));
    });

    it('GET /api/v1/products?maxPrice=30 filters correctly with single maxPrice bound', async () => {
      assert.ok(multiPriceProductId);
      const res = await request(app).get('/api/v1/products?maxPrice=30');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.some((p) => p.id === multiPriceProductId));
    });

    it('Clean up multi-price regression test product', async () => {
      if (multiPriceProductId) {
        await request(app)
          .delete(`/api/v1/products/${multiPriceProductId}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    });
  });

  it('DELETE /api/v1/products/:id removes product and cascades variants', async () => {
    assert.ok(createdProductId);
    const res = await request(app)
      .delete(`/api/v1/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    const verifyRes = await request(app).get(`/api/v1/products/${createdProductId}`);
    assert.strictEqual(verifyRes.statusCode, 404);
  });
});
