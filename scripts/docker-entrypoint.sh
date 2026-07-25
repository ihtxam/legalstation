#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUN_DB_MIGRATE:-true}" == "true" ]] && [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[entrypoint] Applying database migrations…"
  # drizzle-kit is a devDependency; skip if missing in prod image
  if command -v pnpm >/dev/null 2>&1 && pnpm exec drizzle-kit --version >/dev/null 2>&1; then
    pnpm exec drizzle-kit migrate || echo "[entrypoint] migrate skipped/failed (apply manually with pnpm db:push)"
  else
    echo "[entrypoint] drizzle-kit not available in image; run migrations from CI or a job"
  fi
fi

exec "$@"
