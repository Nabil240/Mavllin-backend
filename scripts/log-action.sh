#!/usr/bin/env bash
# ==============================================================================
# scripts/log-action.sh — Synchronized Project Action Logger for Plan.md & plan.md
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/log-action.js" "$@"
