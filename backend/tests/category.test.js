const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Category Management APIs', () => {
  let adminToken;
  let customerToken;
  let createdCategoryId;
  const testCategoryName = `Test Apparel ${Date.now()}`;

  before(() => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();
  });

  it('GET /api/v1/categories returns list of active categories', async () => {
    const res = await request(app).get('/api/v1/categories?activeOnly=true');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/v1/categories?tree=true returns hierarchical category tree', async () => {
    const res = await request(app).get('/api/v1/categories?tree=true');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    if (res.body.data.length > 0) {
      assert.ok('children' in res.body.data[0]);
    }
  });

  it('POST /api/v1/categories rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .send({ name: 'Unauthorized Category' });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  it('POST /api/v1/categories rejects customer role with 403', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Forbidden Category' });
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
  });

  it('POST /api/v1/categories rejects empty payload with 422 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.strictEqual(res.statusCode, 422);
    assert.strictEqual(res.body.success, false);
    assert.ok(Array.isArray(res.body.errors));
    assert.ok(res.body.errors.some((e) => e.field === 'name'));
  });

  it('POST /api/v1/categories creates category with admin token and auto-generates slug', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: testCategoryName,
        description: 'Test category description',
        is_active: 1,
      });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.ok(res.body.data.slug);
    assert.strictEqual(res.body.data.name, testCategoryName);
    createdCategoryId = res.body.data.id;
  });

  it('GET /api/v1/categories/:identifier fetches category by ID', async () => {
    assert.ok(createdCategoryId);
    const res = await request(app).get(`/api/v1/categories/${createdCategoryId}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.id, createdCategoryId);
  });

  it('PUT /api/v1/categories/:id updates category details', async () => {
    assert.ok(createdCategoryId);
    const updatedName = `${testCategoryName} Updated`;
    const res = await request(app)
      .put(`/api/v1/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: updatedName });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.name, updatedName);
  });

  it('DELETE /api/v1/categories/:id deletes category with admin token', async () => {
    assert.ok(createdCategoryId);
    const res = await request(app)
      .delete(`/api/v1/categories/${createdCategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    const verifyRes = await request(app).get(`/api/v1/categories/${createdCategoryId}`);
    assert.strictEqual(verifyRes.statusCode, 404);
  });
});
