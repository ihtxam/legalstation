#!/usr/bin/env bash
# Idempotent Cliavo setup for local machines and Cursor Cloud Agents.
# Usage:
#   bash scripts/dev-setup.sh              # full setup (deps + env + optional DB)
#   bash scripts/dev-setup.sh --install-only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INSTALL_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --install-only) INSTALL_ONLY=1 ;;
  esac
done

echo "[dev-setup] Project root: $ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[dev-setup] Enabling pnpm via corepack..."
  corepack enable
  corepack prepare pnpm@10.4.1 --activate
fi

echo "[dev-setup] Installing dependencies (pnpm)..."
pnpm install --frozen-lockfile

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
  echo "[dev-setup] Install-only complete"
  exit 0
fi

if [[ ! -f .env ]]; then
  echo "[dev-setup] Creating .env from .env.example"
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -hex 32)"
    sed -i "s/JWT_SECRET=change-me-to-a-long-random-string/JWT_SECRET=${secret}/" .env
  fi
fi

# Prefer Docker Compose MySQL when available
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[dev-setup] Starting MySQL via docker compose..."
    docker compose up -d mysql
    echo "[dev-setup] Waiting for MySQL health..."
    for _ in $(seq 1 40); do
      if docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot -proot --silent 2>/dev/null; then
        break
      fi
      sleep 2
    done
  else
    echo "[dev-setup] Docker installed but daemon not running; skip compose MySQL"
  fi
else
  echo "[dev-setup] Docker not available; use MariaDB from cloud image or set DATABASE_URL"
fi

# Apply migrations when DATABASE_URL is present
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[dev-setup] Pushing DB schema (drizzle-kit)..."
  if pnpm db:push; then
    echo "[dev-setup] Database schema up to date"
  else
    echo "[dev-setup] Warning: db:push failed (DB may still be starting). Retry with: pnpm db:push"
  fi
else
  echo "[dev-setup] DATABASE_URL not set; skipping migrations"
fi

echo "[dev-setup] Done."
echo "  Dev server:  pnpm dev"
echo "  Typecheck:   pnpm check"
echo "  Tests:       pnpm test"
echo "  DB migrate:  pnpm db:push"
