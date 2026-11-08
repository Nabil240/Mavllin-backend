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

# Parse CLI arguments
DRY_RUN=false
TOKEN="${GITHUB_TOKEN:-}"

for arg in "$@"; do
  case "${arg}" in
    -h|--help)
      echo "Usage: bash scripts/push-to-github.sh [OPTIONS] [GITHUB_PAT_TOKEN]"
      echo ""
      echo "Synchronize and push MAVLLIN frontend and backend release branches to GitHub."
      echo ""
      echo "Options:"
      echo "  -h, --help       Show this help message and exit"
      echo "  --dry-run        Validate branches and auth without performing remote push"
      echo ""
      echo "Authentication:"
      echo "  Pass token as argument, or set GITHUB_TOKEN environment variable,"
      echo "  or add ~/.ssh/id_ed25519.pub to https://github.com/settings/ssh/new."
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      if [ -z "${TOKEN}" ]; then
        TOKEN="${arg}"
      fi
      ;;
  esac
done

TOKEN="$(echo "${TOKEN}" | tr -d '[:space:]')"

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

echo "=========================================================="
echo " MAVLLIN Dual-Repository GitHub Push Automation"
echo " Target GitHub Account: https://github.com/${GITHUB_USER}"
[ "${DRY_RUN}" = true ] && echo " MODE: DRY RUN (No changes will be pushed)"
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
  PARENT_ARG=""
  if git rev-parse --verify frontend-main >/dev/null 2>&1; then
    PARENT_ARG="-p frontend-main"
  fi
  COMMIT_FE=$(git commit-tree "${TREE_FRONTEND}" ${PARENT_ARG} -m "feat: release MAVLLIN storefront application")
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
  PARENT_ARG=""
  if git rev-parse --verify backend-main >/dev/null 2>&1; then
    PARENT_ARG="-p backend-main"
  else
    PARENT_ARG="-p HEAD"
  fi
  COMMIT_BE=$(git commit-tree "${TREE_BACKEND}" ${PARENT_ARG} -m "feat: release MAVLLIN backend and database services")
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
  echo "      Verifying GitHub Personal Access Token via REST API..."
  USER_API_HEADER=$(curl -s -i -H "Authorization: token ${TOKEN}" "https://api.github.com/user" || true)
  HTTP_STATUS=$(echo "${USER_API_HEADER}" | grep -i "^HTTP" | tail -n 1 | awk '{print $2}')

  if [ "${HTTP_STATUS}" = "200" ]; then
    AUTH_USER=$(echo "${USER_API_HEADER}" | grep -o '"login": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
    echo "      [✔] Authenticated via Token as GitHub user: @${AUTH_USER}"
    AUTH_MODE="TOKEN"
  else
    echo "      [x] Error: Personal Access Token rejected by GitHub (HTTP ${HTTP_STATUS:-connection error})." >&2
    echo "          Please check your token at https://github.com/settings/tokens (requires 'repo' scope)." >&2
    exit 1
  fi
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
# 3. Helper: Push or Create Repository with Candidate Slugs
# ------------------------------------------------------------------------------
# NOTE: All diagnostic output in this function MUST be redirected to stderr (>&2)
# so command substitution $(push_branch_with_slugs ...) captures ONLY the slug.
push_branch_with_slugs() {
  local branch="$1"
  local target_branch="$2"
  local repo_desc="$3"
  shift 3
  local candidates=("$@")
  local success_slug=""

  for slug in "${candidates[@]}"; do
    [ -z "${slug}" ] && continue

    echo "      Trying repository slug: ${slug}..." >&2

    # If using token, check if repo exists on GitHub; auto-create if missing
    if [ "${AUTH_MODE}" = "TOKEN" ]; then
      local check_status
      check_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/${GITHUB_USER}/${slug}" || true)

      if [ "${check_status}" = "404" ]; then
        echo "        Repo '${slug}' does not exist on GitHub. Creating it now..." >&2
        local create_status
        create_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
          -H "Authorization: token ${TOKEN}" \
          -H "Accept: application/vnd.github+json" \
          "https://api.github.com/user/repos" \
          -d "{\"name\":\"${slug}\",\"private\":false,\"description\":\"${repo_desc}\"}" || true)
        if [ "${create_status}" = "201" ]; then
          echo "        [✔] Public repository '${GITHUB_USER}/${slug}' created successfully on GitHub!" >&2
        else
          echo "        [!] GitHub API repo creation returned HTTP ${create_status}." >&2
        fi
      fi
    fi

    local remote_url=""
    if [ "${AUTH_MODE}" = "TOKEN" ]; then
      remote_url="https://${TOKEN}@github.com/${GITHUB_USER}/${slug}.git"
    else
      remote_url="git@github.com:${GITHUB_USER}/${slug}.git"
    fi

    local push_flags=("--force")
    if [ "${DRY_RUN}" = true ]; then
      push_flags+=("--dry-run")
    fi

    local push_output
    if push_output=$(git push "${remote_url}" "${branch}:${target_branch}" "${push_flags[@]}" 2>&1); then
      success_slug="${slug}"
      echo "      [✔] Successfully pushed ${branch} -> ${slug}:${target_branch}!" >&2
      break
    else
      echo "      [x] Slug '${slug}' push failed:" >&2
      while IFS= read -r line; do
        [ -n "${line}" ] && echo "          ${line}" >&2
      done <<< "${push_output}"
    fi
  done

  if [ -z "${success_slug}" ]; then
    echo "[-] Error: Failed to push ${branch} to any candidate repository:" >&2
    for s in "${candidates[@]}"; do
      [ -n "${s}" ] && echo "    - ${s}" >&2
    done
    return 1
  fi

  # Return ONLY the clean repository slug on stdout
  printf "%s" "${success_slug}"
}

# ------------------------------------------------------------------------------
# 4. Execute Remote Pushes
# ------------------------------------------------------------------------------
echo "[3/4] Pushing backend repository..."
if ! BACKEND_SUCCESS=$(push_branch_with_slugs backend-main main "MAVLLIN E-Commerce Backend & Database Services" "${BACKEND_CANDIDATES[@]}"); then
  echo "[-] Backend deployment failed." >&2
  exit 1
fi

echo "[4/4] Pushing frontend repository..."
if ! FRONTEND_SUCCESS=$(push_branch_with_slugs frontend-main main "MAVLLIN E-Commerce Storefront Application" "${FRONTEND_CANDIDATES[@]}"); then
  echo "[-] Frontend deployment failed." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 5. Synchronize Local Remotes & Action Log
# ------------------------------------------------------------------------------
if [ "${DRY_RUN}" = false ]; then
  # Determine primary remote URLs based on auth mode
  if [ "${AUTH_MODE}" = "SSH" ]; then
    BE_PRIMARY="git@github.com:${GITHUB_USER}/${BACKEND_SUCCESS}.git"
    FE_PRIMARY="git@github.com:${GITHUB_USER}/${FRONTEND_SUCCESS}.git"
  else
    BE_PRIMARY="https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git"
    FE_PRIMARY="https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}.git"
  fi

  # Primary remotes
  git remote set-url backend "${BE_PRIMARY}" 2>/dev/null || git remote add backend "${BE_PRIMARY}"
  git remote set-url frontend "${FE_PRIMARY}" 2>/dev/null || git remote add frontend "${FE_PRIMARY}"
  git remote set-url origin "${BE_PRIMARY}" 2>/dev/null || true

  # Protocol-specific remotes
  git remote set-url backend-ssh "git@github.com:${GITHUB_USER}/${BACKEND_SUCCESS}.git" 2>/dev/null || git remote add backend-ssh "git@github.com:${GITHUB_USER}/${BACKEND_SUCCESS}.git"
  git remote set-url frontend-ssh "git@github.com:${GITHUB_USER}/${FRONTEND_SUCCESS}.git" 2>/dev/null || git remote add frontend-ssh "git@github.com:${GITHUB_USER}/${FRONTEND_SUCCESS}.git"
  git remote set-url backend-https "https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git" 2>/dev/null || git remote add backend-https "https://github.com/${GITHUB_USER}/${BACKEND_SUCCESS}.git"
  git remote set-url frontend-https "https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}.git" 2>/dev/null || git remote add frontend-https "https://github.com/${GITHUB_USER}/${FRONTEND_SUCCESS}.git"

  # Log synchronized deployment record
  if [ -f "${ROOT_DIR}/scripts/log-action.sh" ]; then
    bash "${ROOT_DIR}/scripts/log-action.sh" "GitHub Deployment" "Pushed frontend to ${FRONTEND_SUCCESS} and backend to ${BACKEND_SUCCESS}" "scripts/push-to-github.sh, Plan.md, plan.md" "COMPLETED" || true
  fi
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
