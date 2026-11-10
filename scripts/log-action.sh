#!/usr/bin/env bash
# ==============================================================================
# scripts/log-action.sh — Project Action Logger for plan.md
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/log-action.js" "$@"
