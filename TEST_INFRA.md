# Project ECO — End-to-End Testing Infrastructure & Methodology

## 1. Overview & Testing Philosophy

Project ECO employs a rigorous, dual-track testing strategy designed to ensure production-grade reliability, security, and performance for a high-volume fashion e-commerce platform.

The testing architecture is built upon an **Opaque-Box (Black-Box)** paradigm:
- **Zero Internal Coupling**: End-to-End (E2E) tests interact with the application exclusively through its external HTTP REST API endpoints. Tests do not directly import internal models, database pools, or Express route handlers.
- **Specification-Driven**: Every assertion is derived strictly from documented requirements (`ORIGINAL_REQUEST.md`, `PROJECT.md`, `plan.md`), RFC specifications, and interface contracts.
- **Progressive Testability**: E2E test suites are organized by milestone dependencies, allowing incremental verification of active features without premature coupling to unbuilt milestones.
- **Zero-Dependency Native Execution**: Test suites leverage Node.js v22's built-in `node:test` runner, `node:assert/strict`, and native global `fetch`. No heavyweight external test frameworks or browser dependencies are required to run API E2E tests on any environment.

---

## 2. The 4-Tier Testing Methodology

To provide comprehensive verification across functional, defensive, integration, and operational dimensions, test suites are structured into four progressive tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                 Tier 4: Real-World Workloads                │
│   (Burst concurrency, Rate-limiting, Multi-actor workflows) │
├─────────────────────────────────────────────────────────────┤
│            Tier 3: Cross-Feature Interactions               │
│   (Entity lifecycles, Cascades, Multi-filter orchestration) │
├─────────────────────────────────────────────────────────────┤
│             Tier 2: Boundary & Corner Cases                 │
│   (Validation defense, Error envelopes, Adversarial probes) │
├─────────────────────────────────────────────────────────────┤
│                Tier 1: Feature Coverage                     │
│   (Happy path CRUD, Standard contracts, Schema integrity)   │
└─────────────────────────────────────────────────────────────┘
```

### Tier 1: Feature Coverage (Opaque-Box Contract Verification)
- **Objective**: Validate the primary functionality, happy-path flows, and schema contracts for all public and administrative endpoints.
- **Coverage**:
  - Health check endpoint (`GET /api/v1/health`) reporting system uptime and database connection status.
  - Standard security headers enforced by Helmet (`X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Content-Security-Policy`).
  - Standard JSON response envelope structure (`{ success: true, message: string, data: any, meta?: any }`).
  - Category management CRUD (`GET /api/v1/categories`, `GET /api/v1/categories/:idOrSlug`, `POST /api/v1/categories`, `PUT /api/v1/categories/:id`, `DELETE /api/v1/categories/:id`).
  - Product catalog listing (`GET /api/v1/products`) with pagination metadata (`page`, `limit`, `total`, `totalPages`).
  - Product detail lookup (`GET /api/v1/products/:idOrSlug`) returning structured product details and the array of active sellable variants (`product_variants` schema: `sku`, `size`, `color`, `price`, `compareAtPrice`, `stockQuantity`, `isActive`).
  - Admin product & variant creation (`POST /api/v1/products`) persisting product header and variant children in an atomic transaction.

### Tier 2: Boundary & Corner Cases (Defensive & Robustness Testing)
- **Objective**: Verify that invalid inputs, boundary values, malformed data, and edge conditions fail safely, return appropriate HTTP status codes, and preserve database integrity.
- **Coverage**:
  - Standard error envelope enforcement (`{ success: false, message: string, errors?: Array<{ field: string, message: string }> }`).
  - Status code fidelity: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity.
  - Category validation: Missing names, empty/whitespace names, non-integer parent IDs, invalid boolean flags.
  - Product & Variant validation: Missing variants array, empty variants array, non-positive variant prices (`price <= 0`), negative stock quantities (`stockQuantity < 0`), missing SKU, duplicate SKUs within the same product payload.
  - Unique constraint defenses: Attempting to create duplicate category slugs or duplicate variant SKUs across distinct products.
  - Boundary sizes: Extremely long payload strings (10,000+ characters), zero-length inputs, special unicode characters (e.g. emojis, Bengali/non-ASCII apparel names: `শাড়ি`, `পাঞ্জাবি`), decimal price precision.
  - Adversarial injection probes: SQL injection attack vectors in query parameters and JSON fields (e.g. `' OR '1'='1`, `'; DROP TABLE; --`), XSS payloads (`<script>alert(1)</script>`), path traversal tokens (`../../`).
  - Stack trace leakage prevention: Verifying that production error responses never leak stack traces, SQL syntax snippets, or database connection strings.

### Tier 3: Cross-Feature Interactions & Lifecycle Integrity
- **Objective**: Exercise multi-step orchestration across interrelated domain models to ensure referential integrity, transaction atomicity, and consistent state transitions.
- **Coverage**:
  - Full Category-to-Product Lifecycle:
    1. Admin creates a new apparel category (e.g. `Denim Jacket Collection`).
    2. Admin creates a new multi-variant product referencing that category ID.
    3. Public storefront queries `/api/v1/products?category=<id>` and confirms the product is listed.
    4. Storefront queries `/api/v1/products/:slug` and verifies all size/color variants match created specifications.
    5. Admin updates the category name/slug; product query confirms reference continuity.
    6. System prevents or safely handles deletion of a category while associated with active products.
    7. Admin deletes the product; verify atomic cascading deletion of all associated variant records in `product_variants`.
  - Variant Inventory & Storefront Filtering Interaction:
    - Products with mixed variant availability (e.g., Size M stock = 10, Size XL stock = 0).
    - Querying with `inStock=true` filters correctly against variant inventories.
    - Filtering by `size=M` vs `size=XL`, and `color=Indigo`.
    - Price range filtering (`minPrice`, `maxPrice`) accurately comparing against variant prices.
  - Transaction Atomicity Verification:
    - Admin submits product creation with valid product fields but one invalid variant (e.g. duplicate SKU or negative price).
    - Verify that the entire transaction rolls back cleanly, leaving zero orphan rows in the `products` table and zero rows in `product_variants`.

### Tier 4: Real-World Workloads & Operational Resilience
- **Objective**: Validate platform stability under realistic operational conditions, including high concurrency, traffic bursts, rate limiting thresholds, and database connection pooling.
- **Coverage**:
  - Rate Limiter Defense:
    - Rapid-fire burst of 120+ requests within < 2 seconds to test `express-rate-limit`.
    - Verifying HTTP 429 Too Many Requests response with standard error envelope and appropriate rate-limit headers.
  - High-Concurrency Read Stress:
    - Dispatching 50 concurrent parallel requests across `/api/v1/products` and `/api/v1/categories`.
    - Ensuring MySQL connection pool (`mysql2/promise`) acquires and releases connections smoothly without pool starvation, dropped sockets, or HTTP 500 errors.
  - Multi-Actor Parallel Journeys:
    - Simulating parallel storefront browsing sessions (guest catalog search, filter by size/color, detail view) occurring concurrently with admin product updates.
  - Health & Recovery Verification:
    - Verifying `/api/v1/health` reports status `ok` and active database connection before, during, and immediately following load bursts.

---

## 3. Directory Layout & Conventions

All E2E test suites and supporting test utilities are centralized under `tests/e2e/`:

```
/run/media/nabil/New Volume/Project ECO/
├── tests/
│   └── e2e/
│       ├── helpers/
│       │   ├── api-client.js           # Lightweight HTTP request client with assertion helpers
│       │   └── auth-helper.js          # Admin & customer authentication token generators
│       └── milestone2/
│           ├── tier1-feature-coverage.test.js   # Tier 1: Health, Categories, Products & Variants
│           ├── tier2-boundary-corner.test.js    # Tier 2: Validation, Errors, Envelopes & Injections
│           ├── tier3-cross-feature.test.js      # Tier 3: Category-Product Lifecycle & Filter State
│           └── tier4-real-world.test.js         # Tier 4: Concurrency, Rate Limiting & Resilience
├── scripts/
│   └── run-e2e.sh                      # Unified shell runner for host and container environments
├── TEST_INFRA.md                       # This document: architecture & methodology
└── TEST_READY.md                       # Test readiness declaration and execution summary
```

### Naming Conventions
- Test files must end with `.test.js` or `.spec.js`.
- Each test file groups related behaviors using `node:test`'s `describe` blocks.
- Test case titles must clearly declare expected behavior: `it('should return 422 with validation errors when variant price is negative', async () => { ... })`.
- Test data generated dynamically during runs must use a distinctive prefix (e.g., `e2e-test-<timestamp>-<random>`) to prevent collision with static seed data.

---

## 4. Test Execution & CI Integration

### Prerequisites
- Node.js v22.x or later installed on host.
- Backend API running on `http://localhost:5000` (or configured via environment variable `API_URL`).
- MySQL 8.0 database running and seeded (via `scripts/start-db.sh`).

### Environment Variables
| Variable | Default Value | Description |
|---|---|---|
| `API_URL` | `http://localhost:5000` | Target base URL of the running Express API |
| `ADMIN_JWT_SECRET` | `eco_jwt_secret_key_2026_dev` | Secret used to sign test JWT tokens |
| `E2E_TIMEOUT_MS` | `15000` | Per-test timeout in milliseconds |
| `E2E_BURST_CONCURRENCY` | `50` | Concurrency factor for Tier 4 stress tests |

### Running the E2E Test Suite

#### 1. Via Unified Runner Script
```bash
# Run complete Tier 1 - Tier 4 test suite
./scripts/run-e2e.sh

# Target a custom port or remote instance
API_URL="http://localhost:5001" ./scripts/run-e2e.sh

# Run only a specific tier
E2E_TIER="tier1" ./scripts/run-e2e.sh
E2E_TIER="tier2" ./scripts/run-e2e.sh
E2E_TIER="tier3" ./scripts/run-e2e.sh
E2E_TIER="tier4" ./scripts/run-e2e.sh
```

#### 2. Via Direct Node Test Runner (Host)
```bash
# Run all Milestone 2 E2E tests
node --test tests/e2e/milestone2/*.test.js

# Run with verbose TAP or spec reporter
node --test --test-reporter=spec tests/e2e/milestone2/*.test.js
```

---

## 5. Pass/Fail Criteria & Quality Gates

A milestone build is deemed **READY** only when all the following criteria are satisfied:
1. **100% Pass Rate**: Every test in Tier 1, Tier 2, Tier 3, and Tier 4 must exit with code `0`. No skipped, failing, or flaky tests are permitted in production gates.
2. **Contract Fidelity**:
   - Zero deviation from the RFC-compliant error envelope `{ success: false, message: string, errors: [...] }`.
   - Zero leakage of raw SQL errors, stack traces, or environment keys in error payloads.
   - All response headers include mandatory Helmet security headers.
3. **Database Consistency**:
   - Every creation, update, and deletion in test suites must execute cleanly without leaving corrupt or orphaned records in `product_variants` or `categories`.
   - Transaction rollback tests must confirm that failed parent-child inserts produce 0 rows in both tables.
4. **Resilience & Rate Limiting**:
   - Rate limiters must activate under rapid bursts without crashing the Express server.
   - The database connection pool must sustain 50 concurrent queries without dropping connections.
