#!/usr/bin/env bash
# Deploy LexFlow on the current host (intended for Hetzner after bootstrap).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

ENV_FILE="${ENV_FILE:-.env.production}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example and set DOMAIN, JWT_SECRET, MYSQL_PASSWORD, etc."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DOMAIN:-}" ]]; then
  echo "DOMAIN must be set in ${ENV_FILE}"
  exit 1
fi
if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET}" == *"change-me"* || "${JWT_SECRET}" == *"replace-with"* ]]; then
  echo "Set a strong JWT_SECRET in ${ENV_FILE}"
  exit 1
fi

echo "==> Pulling latest (if git repo)…"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only || true
fi

echo "==> Building and starting stack…"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file "${ENV_FILE}" \
  up -d --build --remove-orphans

echo "==> Waiting for health…"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1 \
    || docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "${ENV_FILE}" exec -T app curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "Healthy."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "${ENV_FILE}" ps
    echo "Public URL: https://${DOMAIN}"
    exit 0
  fi
  sleep 5
done

echo "Health check timed out. Recent logs:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "${ENV_FILE}" logs --tail=80 app
exit 1
