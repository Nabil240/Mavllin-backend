#!/usr/bin/env bash
# ==============================================================================
# scripts/push-to-github.sh — Push MAVLLIN frontend & backend to GitHub
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

SSH_KEY="${HOME}/.ssh/id_ed25519"
SSH_PUB="${HOME}/.ssh/id_ed25519.pub"
GITHUB_USER="Nabil240"
FRONTEND_REPO_SLUG="Mavliin-fontend"
FRONTEND_REPO_ALT="Mavllin-frontend"
BACKEND_REPO_SLUG="Mavllin-backend"

TOKEN="${1:-${GITHUB_TOKEN:-}}"

echo "=========================================================="
echo " MAVLLIN Dual-Repository GitHub Push Utility"
echo " Target user: ${GITHUB_USER}"
echo " Frontend repo: ${FRONTEND_REPO_SLUG} (fallback: ${FRONTEND_REPO_ALT})"
echo " Backend repo:  ${BACKEND_REPO_SLUG}"
echo "=========================================================="

# Ensure frontend-main branch exists
if ! git rev-parse --verify frontend-main >/dev/null 2>&1; then
  echo "[-] Creating frontend-main branch from frontend directory tree..."
  TREE=$(git rev-parse HEAD:frontend)
  COMMIT=$(git commit-tree "${TREE}" -m "feat: initial release for MAVLLIN storefront application")
  git branch -f frontend-main "${COMMIT}"
fi

# Ensure backend-main branch exists
if ! git rev-parse --verify backend-main >/dev/null 2>&1; then
  echo "[-] Creating backend-main branch (backend + database services)..."
  GIT_INDEX_FILE=/tmp/temp_backend_idx git read-tree HEAD
  GIT_INDEX_FILE=/tmp/temp_backend_idx git rm -r --cached frontend > /dev/null 2>&1 || true
  TREE_BACKEND=$(GIT_INDEX_FILE=/tmp/temp_backend_idx git write-tree)
  COMMIT_BACKEND=$(git commit-tree "${TREE_BACKEND}" -p HEAD -m "feat: initial release for MAVLLIN backend and database services")
  git branch -f backend-main "${COMMIT_BACKEND}"
  rm -f /tmp/temp_backend_idx
fi

# Check if SSH authentication works
can_ssh=0
if ssh -T -o BatchMode=yes -o StrictHostKeyChecking=accept-new git@github.com 2>&1 | grep -iq "successfully authenticated"; then
  can_ssh=1
fi

if [ -n "${TOKEN}" ]; then
  echo "[+] GitHub Token provided. Pushing via HTTPS..."
  
  # Push Backend
  echo "[1/2] Pushing backend repository to https://github.com/${GITHUB_USER}/${BACKEND_REPO_SLUG}.git..."
  git push "https://${TOKEN}@github.com/${GITHUB_USER}/${BACKEND_REPO_SLUG}.git" backend-main:main --force
  git push "https://${TOKEN}@github.com/${GITHUB_USER}/${BACKEND_REPO_SLUG}.git" main:monorepo-main --force || true
  
  # Push Frontend (try slug then alt)
  echo "[2/2] Pushing frontend repository to https://github.com/${GITHUB_USER}/${FRONTEND_REPO_SLUG}.git..."
  if ! git push "https://${TOKEN}@github.com/${GITHUB_USER}/${FRONTEND_REPO_SLUG}.git" frontend-main:main --force; then
    echo "[!] Retrying frontend push to alternate slug: ${FRONTEND_REPO_ALT}..."
    git push "https://${TOKEN}@github.com/${GITHUB_USER}/${FRONTEND_REPO_ALT}.git" frontend-main:main --force
  fi
  
  echo "[✔] Successfully pushed both repositories to GitHub via Token!"
  exit 0

elif [ "${can_ssh}" -eq 1 ]; then
  echo "[+] SSH key authentication verified! Pushing via SSH..."
  
  # Push Backend
  echo "[1/2] Pushing backend repository to git@github.com:${GITHUB_USER}/${BACKEND_REPO_SLUG}.git..."
  git push "git@github.com:${GITHUB_USER}/${BACKEND_REPO_SLUG}.git" backend-main:main --force
  git push "git@github.com:${GITHUB_USER}/${BACKEND_REPO_SLUG}.git" main:monorepo-main --force || true
  
  # Push Frontend
  echo "[2/2] Pushing frontend repository to git@github.com:${GITHUB_USER}/${FRONTEND_REPO_SLUG}.git..."
  if ! git push "git@github.com:${GITHUB_USER}/${FRONTEND_REPO_SLUG}.git" frontend-main:main --force; then
    echo "[!] Retrying frontend push to alternate slug: ${FRONTEND_REPO_ALT}..."
    git push "git@github.com:${GITHUB_USER}/${FRONTEND_REPO_ALT}.git" frontend-main:main --force
  fi
  
  echo "[✔] Successfully pushed both repositories to GitHub via SSH!"
  exit 0

else
  echo ""
  echo "=========================================================="
  echo " ACTION REQUIRED: GITHUB AUTHENTICATION NEEDED"
  echo "=========================================================="
  echo "Neither SSH authentication nor a Personal Access Token was found."
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
  echo "2. Open GitHub SSH keys in browser:"
  echo "   https://github.com/settings/ssh/new"
  echo "3. Title: 'MAVLLIN Local Dev', Key type: 'Authentication Key', paste the key and click 'Add SSH key'."
  echo "4. Once added, run this script again:"
  echo "   bash scripts/push-to-github.sh"
  echo ""
  echo "OPTION 2: Provide a GitHub Personal Access Token (PAT)"
  echo "--------------------------------------------------------"
  echo "1. Generate a token at https://github.com/settings/tokens (with 'repo' scope)."
  echo "2. Run this script with the token:"
  echo "   bash scripts/push-to-github.sh <YOUR_GITHUB_TOKEN>"
  echo "   OR: export GITHUB_TOKEN=<YOUR_GITHUB_TOKEN> && bash scripts/push-to-github.sh"
  echo "=========================================================="
  exit 1
fi
