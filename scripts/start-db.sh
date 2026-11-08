#!/usr/bin/env bash
# ==============================================================================
# scripts/start-db.sh — Podman MySQL 8.0 Container Launcher
# Uses fuse-overlayfs on external storage + POSIX tmpfs data dir for NTFS safety
# ==============================================================================

set -euo pipefail

if [ -f "/.flatpak-info" ]; then
  PODMAN_CMD="flatpak-spawn --host podman"
else
  PODMAN_CMD="podman"
fi

STORAGE_ROOT="/run/media/nabil/New Volume/.podman-storage"
PROJECT_DIR="/run/media/nabil/New Volume/Project ECO"
DATA_DIR="/tmp/project_eco_mysql_data"
CONTAINER_NAME="project_eco_mysql"
PORT=3306
IMAGE="docker.io/library/mysql:8.0"

SCHEMA_FILE="${PROJECT_DIR}/database/schema.sql"
if [ -f "${PROJECT_DIR}/database/seeds.sql" ]; then
  SEEDS_FILE="${PROJECT_DIR}/database/seeds.sql"
else
  SEEDS_FILE="${PROJECT_DIR}/database/seeds/seed.sql"
fi

DB_NAME="ecommerce_db"
DB_USER="eco_user"
DB_PASS="eco_password"
ROOT_PASS="rootpassword"

run_podman() {
  $PODMAN_CMD --root "${STORAGE_ROOT}" --storage-opt overlay.mount_program=/usr/bin/fuse-overlayfs "$@"
}

ACTION="${1:-start}"

if [ "${ACTION}" = "stop" ]; then
  echo "==> Stopping container '${CONTAINER_NAME}'..."
  run_podman stop "${CONTAINER_NAME}" || true
  echo "==> MySQL container stopped."
  exit 0
fi

if [ "${ACTION}" = "status" ]; then
  echo "==> Checking MySQL container status..."
  run_podman ps -a --filter "name=${CONTAINER_NAME}"
  exit 0
fi

if [ "${ACTION}" = "--reset" ] || [ "${ACTION}" = "reset" ]; then
  echo "==> Resetting database: removing container and data directory..."
  run_podman rm -f "${CONTAINER_NAME}" 2>/dev/null || true
  $PODMAN_CMD unshare rm -rf "${DATA_DIR}" 2>/dev/null || rm -rf "${DATA_DIR}" 2>/dev/null || true
  echo "==> Reset complete. Initializing fresh container..."
fi

if run_podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
  echo "==> Container '${CONTAINER_NAME}' is already running."
  if run_podman exec "${CONTAINER_NAME}" mysql -u "${DB_USER}" -p"${DB_PASS}" -e "SELECT 1;" "${DB_NAME}" >/dev/null 2>&1; then
    echo "==> Database '${DB_NAME}' is healthy and ready on port ${PORT}!"
    exit 0
  fi
fi

# Clean up stale Created/Exited container if its data dir is empty or broken
if run_podman ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
  if [ -d "${DATA_DIR}/mysql" ]; then
    echo "==> Starting existing stopped container '${CONTAINER_NAME}'..."
    run_podman start "${CONTAINER_NAME}" || {
      echo "==> Stale container failed to start; recreating cleanly..."
      run_podman rm -f "${CONTAINER_NAME}" 2>/dev/null || true
      rm -rf "${DATA_DIR}" 2>/dev/null || true
    }
  else
    run_podman rm -f "${CONTAINER_NAME}" 2>/dev/null || true
  fi
fi

if ! run_podman ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
  mkdir -p "${STORAGE_ROOT}" "${DATA_DIR}"

  echo "==> Launching MySQL 8.0 container '${CONTAINER_NAME}'..."
  run_podman run -d \
    --name "${CONTAINER_NAME}" \
    --security-opt label=disable \
    -p "${PORT}:3306" \
    -e MYSQL_ROOT_PASSWORD="${ROOT_PASS}" \
    -e MYSQL_DATABASE="${DB_NAME}" \
    -e MYSQL_USER="${DB_USER}" \
    -e MYSQL_PASSWORD="${DB_PASS}" \
    -v "${DATA_DIR}:/var/lib/mysql" \
    -v "${SCHEMA_FILE}:/docker-entrypoint-initdb.d/01-schema.sql:ro" \
    -v "${SEEDS_FILE}:/docker-entrypoint-initdb.d/02-seeds.sql:ro" \
    "${IMAGE}" \
    --default-authentication-plugin=mysql_native_password
fi

echo "==> Waiting for MySQL 8.0 to initialize and accept connections..."
MAX_RETRIES=45
RETRIES=0

until run_podman exec "${CONTAINER_NAME}" mysql -u "${DB_USER}" -p"${DB_PASS}" -e "SELECT 1;" "${DB_NAME}" >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo ""
    echo "ERROR: MySQL failed to become ready within $((MAX_RETRIES * 2)) seconds."
    run_podman logs --tail 40 "${CONTAINER_NAME}"
    exit 1
  fi
  printf "."
  sleep 2
done

echo ""
echo "================================================================================"
echo " [SUCCESS] MySQL 8.0 database is up, schema & seeds applied, and ready!"
echo " Container:  ${CONTAINER_NAME}"
echo " Host/Port:  127.0.0.1:${PORT}"
echo " Database:   ${DB_NAME}"
echo " User:       ${DB_USER}"
echo "================================================================================"
