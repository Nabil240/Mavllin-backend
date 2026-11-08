const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../helpers/api-client');

describe('Tier 4: Real-World Workloads & Operational Resilience (Milestone 2)', () => {
  const CONCURRENCY_LEVEL = Number(process.env.E2E_BURST_CONCURRENCY) || 40;

  describe('1. Connection Pool & High Concurrency Read Stress', () => {
    test(`Dispatching ${CONCURRENCY_LEVEL} parallel catalog read requests should sustain zero connection dropped errors`, async () => {
      const endpoints = [
        '/api/v1/products?page=1&limit=10',
        '/api/v1/categories',
        '/api/v1/products/featured',
        '/api/v1/health',
      ];

      const promises = Array.from({ length: CONCURRENCY_LEVEL }, (_, index) => {
        const target = endpoints[index % endpoints.length];
        return client.get(target);
      });

      const results = await Promise.all(promises);

      assert.equal(results.length, CONCURRENCY_LEVEL);

      let successCount = 0;
      let rateLimitedCount = 0;
      let internalErrorCount = 0;

      for (const res of results) {
        if (res.status === 200) {
          successCount += 1;
        } else if (res.status === 429) {
          rateLimitedCount += 1;
        } else if (res.status >= 500) {
          internalErrorCount += 1;
        }
      }

      assert.equal(
        internalErrorCount,
        0,
        `Connection pool or server produced ${internalErrorCount} HTTP 500 errors during concurrency test`
      );

      assert.ok(
        successCount + rateLimitedCount === CONCURRENCY_LEVEL,
        `All requests must either succeed (200) or be throttled gracefully (429). Succeeded: ${successCount}, Throttled: ${rateLimitedCount}`
      );
    });
  });

  describe('2. Multi-Actor Storefront Browsing Simulation', () => {
    test('Simultaneous browsing journeys (categories -> product search -> variant inspection) should execute consistently', async () => {
      const journeys = Array.from({ length: 15 }, async (_, i) => {
        // Step 1: Browse categories
        const catRes = await client.get('/api/v1/categories');
        assert.ok(catRes.status === 200 || catRes.status === 429);

        // Step 2: Browse products with filter
        const prodRes = await client.get('/api/v1/products', {
          query: { page: (i % 2) + 1, limit: 5 },
        });
        assert.ok(prodRes.status === 200 || prodRes.status === 429);

        // Step 3: Fetch featured
        const featRes = await client.get('/api/v1/products/featured');
        assert.ok(featRes.status === 200 || featRes.status === 429);

        return true;
      });

      const journeyResults = await Promise.all(journeys);
      assert.equal(journeyResults.length, 15);
      assert.ok(journeyResults.every(Boolean));
    });
  });

  describe('3. Rate Limiter Defense & Threshold Behavior', () => {
    test('High-frequency request burst should gracefully activate rate limiter (429) without crashing service', async () => {
      // Target the authentication login endpoint protected by authLimiter (max: 20 req / 15 min window)
      // Sending a burst of 25 rapid requests will exhaust the quota of 20 and trigger HTTP 429 on subsequent requests.
      const burstSize = 25;
      const targetEndpoint = '/api/v1/auth/login';
      const burstPayload = {
        email: 'ratelimit-probe@projecteco.com',
        password: 'InvalidPassword123!',
      };

      const burstPromises = Array.from({ length: burstSize }, () =>
        client.post(targetEndpoint, burstPayload, {
          headers: { 'x-test-rate-limit': 'true' },
        })
      );

      const responses = await Promise.all(burstPromises);
      assert.equal(responses.length, burstSize, `Expected ${burstSize} responses`);

      const statuses = responses.map((r) => r.status);
      const hasRateLimited = statuses.includes(429);
      const hasHandled = statuses.some((s) => s === 401 || s === 422 || s === 200);

      // Verify that initial requests before threshold were processed, or IP is already throttled from prior bursts
      if (statuses.some((s) => s !== 429)) {
        assert.ok(
          hasHandled,
          `Initial requests before threshold should be processed (observed statuses: ${statuses.slice(0, 5).join(', ')})`
        );
      }

      // Unconditional assertion: Rate limiter MUST activate and return HTTP 429
      assert.strictEqual(
        hasRateLimited,
        true,
        `Rate limiter must activate and return HTTP 429 when burst (${burstSize}) exceeds threshold (20). Observed statuses: ${statuses.join(', ')}`
      );

      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      assert.ok(
        rateLimitedResponses.length >= 1,
        `Expected at least 1 throttled response, got ${rateLimitedResponses.length}`
      );

      // Validate RFC-compliant standard error envelope on 429 responses
      const sample429 = rateLimitedResponses[0];
      assert.ok(sample429, 'Found 429 response');
      client.assertErrorEnvelope(sample429, 429);
      assert.strictEqual(sample429.body.success, false, 'Rate limit error envelope success flag must be false');
      assert.ok(
        typeof sample429.body.message === 'string' &&
          (sample429.body.message.toLowerCase().includes('too many') ||
            sample429.body.message.toLowerCase().includes('rate limit') ||
            sample429.body.message.toLowerCase().includes('exceeded') ||
            sample429.body.message.toLowerCase().includes('slow down') ||
            sample429.body.message.toLowerCase().includes('try again')),
        `429 message should indicate rate limit exceeded: "${sample429.body.message}"`
      );
    });
  });

  describe('4. Post-Stress Health & Database Continuity', () => {
    test('Health check should confirm live database connectivity immediately following stress execution', async () => {
      const res = await client.get('/api/v1/health');

      // Health endpoint should remain available or recover immediately
      if (res.status === 200) {
        assert.equal(res.body.status, 'ok');
        assert.ok(res.body.database);
        assert.equal(res.body.database.status, 'connected');
      } else {
        // If throttled by rate limiter, wait 1 second and retry once
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retryRes = await client.get('/api/v1/health');
        assert.equal(retryRes.status, 200, `Health check after recovery failed with ${retryRes.status}`);
        assert.equal(retryRes.body.status, 'ok');
        assert.equal(retryRes.body.database.status, 'connected');
      }
    });
  });
});
