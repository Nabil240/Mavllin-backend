const assert = require('node:assert/strict');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

class ApiClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async request(method, endpoint, options = {}) {
    const { body, headers = {}, token, query } = options;

    let urlString = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (query && Object.keys(query).length > 0) {
      const url = new URL(urlString);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
      urlString = url.toString();
    }

    const requestHeaders = {
      Accept: 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    let payload;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string') {
        payload = body;
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      } else {
        payload = JSON.stringify(body);
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(urlString, {
      method,
      headers: requestHeaders,
      body: payload,
    });

    const rawText = await response.text();
    let parsedBody = null;
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = rawText;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: parsedBody,
      rawText,
      ok: response.ok,
    };
  }

  get(endpoint, options) {
    return this.request('GET', endpoint, options);
  }

  post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, body });
  }

  patch(endpoint, body, options = {}) {
    return this.request('PATCH', endpoint, { ...options, body });
  }

  delete(endpoint, options) {
    return this.request('DELETE', endpoint, options);
  }

  // --- Contract Assertions ---

  assertSuccessEnvelope(res, expectedStatus = 200) {
    assert.equal(
      res.status,
      expectedStatus,
      `Expected HTTP ${expectedStatus}, received HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
    assert.ok(res.body, 'Response body must not be empty');
    assert.equal(res.body.success, true, 'Envelope success flag must be true');
    assert.equal(typeof res.body.message, 'string', 'Envelope message must be a string');
  }

  assertErrorEnvelope(res, expectedStatus) {
    if (expectedStatus !== undefined) {
      assert.equal(
        res.status,
        expectedStatus,
        `Expected HTTP ${expectedStatus}, received HTTP ${res.status}: ${JSON.stringify(res.body)}`
      );
    } else {
      assert.ok(
        res.status >= 400 && res.status < 600,
        `Expected 4xx or 5xx status code, received HTTP ${res.status}`
      );
    }

    assert.ok(res.body, 'Error response body must not be empty');
    assert.equal(res.body.success, false, 'Envelope success flag must be false');
    assert.equal(typeof res.body.message, 'string', 'Error message must be a string');

    // Security check: Never leak internal call stacks or DB connection strings
    if (process.env.NODE_ENV === 'production' || process.env.STRICT_SECURITY === 'true') {
      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes('node_modules'), 'Error payload must not leak node_modules file paths');
      assert.ok(!raw.includes('sqlMessage'), 'Error payload must not leak raw sqlMessage in production');
      assert.ok(!raw.includes('SELECT'), 'Error payload must not leak raw SQL query fragments');
    }
  }

  assertValidationError(res, expectedField) {
    this.assertErrorEnvelope(res, 422);
    assert.ok(
      Array.isArray(res.body.errors),
      `Expected res.body.errors to be an array, got: ${typeof res.body.errors}`
    );
    assert.ok(res.body.errors.length > 0, 'Validation errors array must not be empty');

    if (expectedField) {
      const fieldMatched = res.body.errors.some(
        (err) => err.field === expectedField || err.path === expectedField || err.param === expectedField
      );
      assert.ok(
        fieldMatched,
        `Expected validation error on field "${expectedField}". Found errors on: ${res.body.errors.map((e) => e.field || e.path || e.param).join(', ')}`
      );
    }
  }

  assertSecurityHeaders(res) {
    const nosniff = res.headers.get('x-content-type-options');
    assert.equal(
      nosniff,
      'nosniff',
      `Expected X-Content-Type-Options: nosniff header, found: ${nosniff}`
    );
  }
}

const client = new ApiClient();

module.exports = {
  ApiClient,
  client,
  BASE_URL,
};
