#!/usr/bin/env bash
# Deploy Cliavo on a Hetzner (or any Docker) host using docker-compose.prod.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy from .env.example and fill secrets first."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

: "${JWT_SECRET:?JWT_SECRET required}"
: "${MYSQL_PASSWORD:=${MYSQL_PASSWORD:-cliavo}}"
export MYSQL_PASSWORD
export MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-${MYSQL_PASSWORD}}"

echo "[hetzner-deploy] Building and starting stack…"
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "[hetzner-deploy] Waiting for MySQL…"
for i in $(seq 1 40); do
  if docker compose -f docker-compose.prod.yml exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "[hetzner-deploy] App should be on http://127.0.0.1:${PORT:-3000}"
echo "Put Caddy/Nginx + TLS in front (see docs/hetzner-deploy.md)."
echo "Apply DB schema from a machine with drizzle-kit: DATABASE_URL=... pnpm db:push"
