# Dead Ends Tracking — Project ECO

This document tracks flawed approaches to prevent oscillation and repeated mistakes across iterations.

| Iteration | Approach Tried | Why It Failed | Files Touched |
|-----------|---------------|---------------|---------------|
| M2 Iter 1 | Separate `EXISTS` subqueries for `minPrice` and `maxPrice` in `ProductModel.findAll` and `countAll` | For products with wide variant prices (e.g. $20 and $150), querying `minPrice=50&maxPrice=80` returned false positives because Variant B satisfied `>= 50` and Variant A satisfied `<= 80` independently. Both constraints must be combined into a single variant subquery. | `backend/src/models/product.model.js` |
| M2 Iter 1 | Calling `SELECT ... FOR UPDATE` directly on `pool` in `adjustVariantStock` when `connection` is null | Pool queries execute in autocommit mode, releasing the row lock immediately at statement completion. Application-level stock recalculation causes lost updates and overselling under concurrent load. Must use atomic SQL updates or explicit transaction scoping. | `backend/src/models/product.model.js` |
| M2 Iter 1 | Placing `connection.beginTransaction()` outside `try ... finally` in `ProductModel.create` | If `beginTransaction()` fails or rejects, `connection.release()` in `finally` is never called, causing permanent connection pool exhaustion. | `backend/src/models/product.model.js` |
| M2 Iter 1 | Testing rate limiting in Tier 4 E2E against `/api/v1/health` with `if (hasRateLimited)` wrapper | Health endpoints are explicitly exempted from rate limiting in `rateLimit.middleware.js`, making the 429 assertions never run and resulting in a self-certifying pass. Must test against a throttled route and assert HTTP 429 unconditionally. | `tests/e2e/milestone2/tier4-real-world.test.js` |
| M2 Iter 1 | Declaring `authLimiter` and `searchLimiter` in middleware without importing/mounting in routes | Authentication and product catalog routes remained protected only by global 300-req limit rather than strict 20-req auth protection. | `backend/src/routes/auth.routes.js`, `backend/src/routes/product.routes.js` |
