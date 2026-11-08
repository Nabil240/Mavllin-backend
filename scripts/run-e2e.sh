#!/usr/bin/env bash
# ==============================================================================
# Project ECO — E2E Test Suite Runner
# Executes opaque-box End-to-End tests following 4-tier methodology
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

API_URL="${API_URL:-http://localhost:5000}"
E2E_TIER="${E2E_TIER:-all}"
NODE_CMD="node"

# Check if running in sandboxed environment where flatpak-spawn is needed
if ! command -v node &> /dev/null; then
  if command -v flatpak-spawn &> /dev/null; then
    NODE_CMD="flatpak-spawn --host node"
  else
    echo "[-] Error: 'node' executable not found in PATH."
    exit 1
  fi
fi

echo "=========================================================="
echo " Project ECO — E2E Test Runner"
echo " Target API:   ${API_URL}"
echo " Target Tier:  ${E2E_TIER}"
echo " Node Command: ${NODE_CMD}"
echo "=========================================================="

# Check API availability
echo "[*] Verifying API availability at ${API_URL}..."
API_AVAILABLE=false
if curl -s -f -m 3 "${API_URL}/api/v1/health" > /dev/null 2>&1; then
  API_AVAILABLE=true
  echo "[+] Health check passed (/api/v1/health)."
elif curl -s -f -m 3 "${API_URL}/health" > /dev/null 2>&1; then
  API_AVAILABLE=true
  echo "[+] Base health check passed (/health)."
else
  echo "[!] Warning: API at ${API_URL} does not appear to be currently responding."
  echo "    Ensure the backend is started (e.g. 'cd backend && npm start') and MySQL container is active."
fi

# Determine test files to execute
TEST_FILES=()

case "${E2E_TIER}" in
  tier1)
    TEST_FILES+=("tests/e2e/milestone2/tier1-feature-coverage.test.js")
    ;;
  tier2)
    TEST_FILES+=("tests/e2e/milestone2/tier2-boundary-corner.test.js")
    ;;
  tier3)
    TEST_FILES+=("tests/e2e/milestone2/tier3-cross-feature.test.js")
    ;;
  tier4)
    TEST_FILES+=("tests/e2e/milestone2/tier4-real-world.test.js")
    ;;
  all)
    TEST_FILES+=(
      "tests/e2e/milestone2/tier1-feature-coverage.test.js"
      "tests/e2e/milestone2/tier2-boundary-corner.test.js"
      "tests/e2e/milestone2/tier3-cross-feature.test.js"
      "tests/e2e/milestone2/tier4-real-world.test.js"
    )
    ;;
  *)
    echo "[-] Unknown tier: ${E2E_TIER}. Valid options: all, tier1, tier2, tier3, tier4"
    exit 1
    ;;
esac

echo "[*] Running test files: ${TEST_FILES[*]}"
echo "----------------------------------------------------------"

# Execute tests via Node.js native test runner
export API_URL="${API_URL}"

if [[ "${NODE_CMD}" == *"flatpak-spawn"* ]]; then
  flatpak-spawn --host bash -c "cd '${PROJECT_ROOT}' && API_URL='${API_URL}' node --test ${TEST_FILES[*]}"
else
  ${NODE_CMD} --test "${TEST_FILES[@]}"
fi

echo "----------------------------------------------------------"
echo "[+] E2E test execution completed successfully."
