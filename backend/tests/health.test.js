const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

describe('Foundation Hardening & Health API Tests', () => {
  it('GET /api/v1/health returns health status and database object', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.ok(res.status === 200 || res.status === 503);
    assert.ok(res.body.status === 'ok' || res.body.status === 'degraded');
    assert.equal(res.body.service, 'mavllin-api');
    assert.ok(res.body.timestamp);
    assert.ok(res.body.database);
    assert.ok(['connected', 'disconnected'].includes(res.body.database.status));
  });

  it('GET /health root route returns identical health contract', async () => {
    const res = await request(app).get('/health');
    assert.ok(res.status === 200 || res.status === 503);
    assert.equal(res.body.service, 'mavllin-api');
    assert.ok(res.body.database);
  });

  it('Applies Helmet security headers on responses', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  it('Handles 404 routes with standardized error envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint-xyz');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.includes('Route Not Found'));
  });

  it('Handles malformed JSON payloads with 400 Bad Request error envelope', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"bad_json": ');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.message.includes('Malformed JSON payload'));
  });
});
