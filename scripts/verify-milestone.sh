#!/usr/bin/env bash
# ==============================================================================
# Project ECO - Milestone 2 Automated Verification Script
# Verifies Database Schema, Seed Data, Automated Tests, and Live Endpoints
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Detect if inside sandbox or on host
EXEC_NODE="node"
EXEC_NPM="npm"
if ! command -v node &>/dev/null && command -v flatpak-spawn &>/dev/null; then
  EXEC_NODE="flatpak-spawn --host node"
  EXEC_NPM="flatpak-spawn --host npm"
fi

COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_BLUE="\033[0;34m"
COLOR_RESET="\033[0m"

log_info() { echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $1"; }
log_pass() { echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $1"; }
log_fail() { echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $1"; exit 1; }

echo "========================================================"
echo " PROJECT ECO - MILESTONE 2 AUTOMATED VERIFICATION GATE  "
echo "========================================================"

# Step 1: Database Connectivity Probe
log_info "Step 1: Checking MySQL 8.0 database connectivity..."
${EXEC_NODE} -e '
  const mysql = require("./backend/node_modules/mysql2/promise");
  const env = require("./backend/src/config/env");
  (async () => {
    try {
      const conn = await mysql.createConnection({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
      });
      await conn.ping();
      await conn.end();
      process.exit(0);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
' || log_fail "Cannot connect to MySQL database at localhost:3306. Run scripts/start-db.sh first."
log_pass "Database connection successful."

# Step 2: DDL Schema Verification
log_info "Step 2: Verifying database tables and relations in MySQL..."
${EXEC_NODE} -e '
  const mysql = require("./backend/node_modules/mysql2/promise");
  const env = require("./backend/src/config/env");
  (async () => {
    const conn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });
    const [tables] = await conn.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);
    const required = ["products", "product_variants", "inventory_movements", "categories", "users"];
    for (const r of required) {
      if (!tableNames.includes(r)) {
        console.error(`Missing required table: ${r}`);
        process.exit(1);
      }
    }
    await conn.end();
    process.exit(0);
  })();
' || log_fail "Schema verification failed: required variant/inventory tables missing."
log_pass "Database schema contains products, product_variants, inventory_movements, and categories."

# Step 3: Seed Data Verification
log_info "Step 3: Verifying seed data population..."
${EXEC_NODE} -e '
  const mysql = require("./backend/node_modules/mysql2/promise");
  const env = require("./backend/src/config/env");
  (async () => {
    const conn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });
    const [[catCount]] = await conn.query("SELECT COUNT(*) as count FROM categories");
    const [[prodCount]] = await conn.query("SELECT COUNT(*) as count FROM products");
    const [[varCount]] = await conn.query("SELECT COUNT(*) as count FROM product_variants");
    if (catCount.count === 0 || prodCount.count === 0 || varCount.count === 0) {
      console.error(`Insufficient seed data: categories=${catCount.count}, products=${prodCount.count}, variants=${varCount.count}`);
      process.exit(1);
    }
    await conn.end();
    process.exit(0);
  })();
' || log_fail "Seed data verification failed: database tables are empty."
log_pass "Seed data verified: categories, products, and variants populated."

# Step 4: Execute Automated Test Suite (node:test + supertest)
log_info "Step 4: Executing automated test suite in backend/tests/..."
(cd "${BACKEND_DIR}" && ${EXEC_NODE} --test --test-force-exit tests/**/*.test.js) || log_fail "Automated test suite failed."
log_pass "All automated tests in backend/tests/ passed cleanly."

# Step 5: Direct HTTP Verification Assertions
log_info "Step 5: Verifying Express application endpoints in-process..."
${EXEC_NODE} -e '
  const request = require("./backend/node_modules/supertest");
  const app = require("./backend/src/app");
  (async () => {
    // 1. Health endpoint
    const hRes = await request(app).get("/api/v1/health");
    if (hRes.statusCode !== 200 || hRes.body.database?.status !== "connected") {
      throw new Error(`Health check failed: ${hRes.statusCode}`);
    }

    // 2. Categories listing
    const cRes = await request(app).get("/api/v1/categories");
    if (cRes.statusCode !== 200 || !Array.isArray(cRes.body.data)) {
      throw new Error(`Categories endpoint failed: ${cRes.statusCode}`);
    }

    // 3. Products with variants
    const pRes = await request(app).get("/api/v1/products");
    if (pRes.statusCode !== 200 || !Array.isArray(pRes.body.data)) {
      throw new Error(`Products endpoint failed: ${pRes.statusCode}`);
    }

    // 4. Input validation rejection (422)
    const vRes = await request(app).post("/api/v1/categories").send({});
    if (vRes.statusCode !== 401 && vRes.statusCode !== 422) {
      throw new Error(`Expected 401 or 422 for unauthenticated/empty category, got: ${vRes.statusCode}`);
    }

    process.exit(0);
  })().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
' || log_fail "In-process HTTP endpoint assertions failed."
log_pass "In-process HTTP endpoints verified: Health (200), Categories (200), Products (200), and Rejections (422/401)."

echo "========================================================"
echo -e "${COLOR_GREEN}MILESTONE 2 VERIFICATION COMPLETE: ALL GATES PASSED (EXIT 0)${COLOR_RESET}"
echo "========================================================"
exit 0
