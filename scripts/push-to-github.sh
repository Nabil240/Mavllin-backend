#!/usr/bin/env bash
# ==============================================================================
# scripts/push-to-github.sh — Push MAVLLIN frontend & backend to GitHub
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# Prevent Git from hanging indefinitely on terminal auth prompts
export GIT_TERMINAL_PROMPT=0

SSH_KEY="${HOME}/.ssh/id_ed25519"
SSH_PUB="${HOME}/.ssh/id_ed25519.pub"
GITHUB_USER="Nabil240"

# Candidate repository slugs in priority order
FRONTEND_CANDIDATES=(
  "${FRONTEND_REPO:-}"
  "Mavliin-fontend"
  "Mavllin-frontend"
  "Mavliin-frontend"
  "Mavllin-fontend"
)

BACKEND_CANDIDATES=(
  "${BACKEND_REPO:-}"
  "Mavllin-backend"
  "Mavliin-backend"
)

TOKEN="${1:-${GITHUB_TOKEN:-}}"

echo "=========================================================="
echo " MAVLLIN Dual-Repository GitHub Push Automation"
echo " Target GitHub Account: https://github.com/${GITHUB_USER}"
echo "=========================================================="

# ------------------------------------------------------------------------------
# 1. Synchronize Release Branches from Current Monorepo HEAD
# ------------------------------------------------------------------------------
echo "[1/4] Synchronizing release branches from current HEAD..."

# Synchronize frontend-main (pure frontend/ directory tree at repository root)
TREE_FRONTEND=$(git rev-parse HEAD:frontend)
CURRENT_FE_TREE=""
if git rev-parse --verify frontend-main >/dev/null 2>&1; then
  CURRENT_FE_TREE=$(git rev-parse frontend-main^{tree} 2>/dev/null || true)
fi

if [ "${CURRENT_FE_TREE}" != "${TREE_FRONTEND}" ]; then
  COMMIT_FE=$(git commit-tree "${TREE_FRONTEND}" -m "feat: release MAVLLIN storefront application")
  git branch -f frontend-main "${COMMIT_FE}"
  echo "      -> frontend-main updated (commit ${COMMIT_FE:0:7})"
else
  echo "      -> frontend-main is already up to date with HEAD:frontend."
fi

# Synchronize backend-main (all backend, database, docker, test files; frontend excluded)
TEMP_INDEX=$(mktemp -t git_backend_idx.XXXXXX)
GIT_INDEX_FILE="${TEMP_INDEX}" git read-tree HEAD
GIT_INDEX_FILE="${TEMP_INDEX}" git rm -r --cached frontend >/dev/null 2>&1 || true
TREE_BACKEND=$(GIT_INDEX_FILE="${TEMP_INDEX}" git write-tree)
rm -f "${TEMP_INDEX}"

CURRENT_BE_TREE=""
if git rev-parse --verify backend-main >/dev/null 2>&1; then
  CURRENT_BE_TREE=$(git rev-parse backend-main^{tree} 2>/dev/null || true)
fi

if [ "${CURRENT_BE_TREE}" != "${TREE_BACKEND}" ]; then
  COMMIT_BE=$(git commit-tree "${TREE_BACKEND}" -p HEAD -m "feat: release MAVLLIN backend and database services")
  git branch -f backend-main "${COMMIT_BE}"
  echo "      -> backend-main updated (commit ${COMMIT_BE:0:7})"
else
  echo "      -> backend-main is already up to date with current HEAD."
fi

# ------------------------------------------------------------------------------
# 2. Verify Authentication Method
# ------------------------------------------------------------------------------
echo "[2/4] Verifying GitHub authentication..."
AUTH_MODE=""

if [ -n "${TOKEN}" ]; then
  AUTH_MODE="TOKEN"
  echo "      -> Using GitHub Personal Access Token authentication."
else
  # Probe SSH with 5s timeout and batch mode
  if ssh -T -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 git@github.com 2>&1 | grep -iq "successfully authenticated"; then
    AUTH_MODE="SSH"
    echo "      -> Using verified SSH key authentication (${SSH_KEY})."
  fi
fi

if [ -z "${AUTH_MODE}" ]; then
  echo ""
  echo "=========================================================="
  echo " ACTION REQUIRED: GITHUB AUTHENTICATION NEEDED"
  echo "=========================================================="
  echo "Neither verified SSH authentication nor a Personal Access Token was found."
  echo ""
  echo "Choose ONE of the following options to authorize git push:"
  echo ""
  echo "OPTION 1: Authorize the SSH Key (Recommended & Fastest)"
  echo "--------------------------------------------------------"
  echo "1. Copy this SSH public key:"
  echo ""
  if [ -f "${SSH_PUB}" ]; then
    cat "${SSH_PUB}"
  else
    echo "SSH key not found at ${SSH_PUB}. Run ssh-keygen first."
  fi
  echo ""
  echo "2. Open GitHub SSH keys settings in browser:"
  echo "   https://github.com/settings/ssh/new"
  echo "3. Title: 'MAVLLIN Local Dev', Key type: 'Authentication Key', paste the key and click 'Add SSH key'."
  echo "4. Once added, run this script again:"
  echo "   bash scripts/push-to-github.sh"
  echo ""
  echo "OPTION 2: Provide a GitHub Personal Access Token (PAT)"
  echo "--------------------------------------------------------"
  echo "1. Generate a token at https://github.com/settings/tokens (select 'repo' scope)."
  echo "2. Run this script with the token:"
  echo "   bash scripts/push-to-github.sh <YOUR_GITHUB_TOKEN>"
  echo "   OR: export GITHUB_TOKEN=<YOUR_GITHUB_TOKEN> && bash scripts/push-to-github.sh"
  echo "=========================================================="
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Push Helper Function with Fallback Slugs
# ------------------------------------------------------------------------------
push_branch_with_slugs() {
  local branch="$1"
  local target_branch="$2"
  shift 2
  local candidates=("$@")
  local success_slug=""

  for slug in "${candidates[@]}"; do
    [ -z "${slug}" ] && continue
    local remote_url=""
    if [ "${AUTH_MODE}" = "TOKEN" ]; then
      remote_url="https://${TOKEN}@github.com/${GITHUB_USER}/${slug}.git"
    else
      remote_url="git@github.com:${GITHUB_USER}/${slug}.git"
    fi

    echo "      Trying slug: ${slug}..."
    if git push "${remote_url}" "${branch}:${target_branch}" --force >/dev/null 2>&1; then
      success_slug="${slug}"
      echo "      [✔] Successfully pushed ${branch} -> ${slug}:${target_branch}!"
      break
    else
      echo "      [x] Slug ${slug} was not accessible or push was rejected."
    fi
  done

  if [ -z "${success_slug}" ]; then
    echo "[-] Error: Failed to push ${branch} to any of the candidate repositories:"
    printf "    - %s\n" "${candidates[@]}"
    return 1
  fi

  echo "${success_slug}"
}

# ------------------------------------------------------------------------------
# 4. Execute Remote Pushes
# ------------------------------------------------------------------------------
echo "[3/4] Pushing backend repository..."
BACKEND_SUCCESS=$(push_branch_with_slugs backend-main main "${BACKEND_CANDIDATES[@]}")
if [ -z "${BACKEND_SUCCESS}" ]; then
  echo "[-] Backend deployment failed."
  exit 1
fi

echo "[4/4] Pushing frontend repository..."
FRONTEND_SUCCESS=$(push_branch_with_slugs frontend-main main "${FRONTEND_CANDIDATES[@]}")
if [ -z "${FRONTEND_SUCCESS}" ]; then
  echo "[-] Frontend deployment failed."
  exit 1
fi

# Update local git remotes to point to the confirmed repositories
git remote set-url backend "https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git" 2>/dev/null || git remote add backend "https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git"
git remote set-url frontend "https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}.git" 2>/dev/null || git remote add frontend "https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}.git"
git remote set-url origin "https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git" 2>/dev/null || true

# Log synchronized deployment record
if [ -f "${ROOT_DIR}/scripts/log-action.sh" ]; then
  bash "${ROOT_DIR}/scripts/log-action.sh" "GitHub Deployment" "Pushed frontend to ${FRONTEND_SUCCESS} and backend to ${BACKEND_SUCCESS}" "scripts/push-to-github.sh, Plan.md, plan.md" "COMPLETED" || true
fi

echo ""
echo "=========================================================="
echo " [✔] MAVLLIN DUAL-REPOSITORY DEPLOYMENT COMPLETED!"
echo "=========================================================="
echo " Frontend Storefront Repository:"
echo "   https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}"
echo ""
echo " Backend & Database Repository:"
echo "   https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}"
echo "=========================================================="
exit 0
