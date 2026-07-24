#!/usr/bin/env bash
# One-shot startup for Cursor Cloud Agents: start MariaDB and ensure schema DB exists.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

start_mariadb() {
  if command -v mysqld >/dev/null 2>&1 || command -v mariadbd >/dev/null 2>&1; then
    if sudo mysqladmin ping -h 127.0.0.1 --silent 2>/dev/null; then
      echo "[cloud-start] MariaDB already running"
      return 0
    fi
    echo "[cloud-start] Starting MariaDB..."
    if sudo service mariadb start 2>/dev/null || sudo service mysql start 2>/dev/null; then
      sleep 2
    else
      echo "[cloud-start] Could not start MariaDB via service manager"
      return 1
    fi
  else
    echo "[cloud-start] MariaDB not installed; skipping (set DATABASE_URL secret or use docker compose)"
    return 0
  fi
}

ensure_database() {
  if ! command -v mysql >/dev/null 2>&1 && ! command -v mariadb >/dev/null 2>&1; then
    return 0
  fi

  local mysql_bin
  mysql_bin="$(command -v mariadb || command -v mysql)"

  echo "[cloud-start] Ensuring lexflow database and user exist..."
  sudo "$mysql_bin" -e "
    CREATE DATABASE IF NOT EXISTS lexflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'lexflow'@'%' IDENTIFIED BY 'lexflow';
    CREATE USER IF NOT EXISTS 'lexflow'@'localhost' IDENTIFIED BY 'lexflow';
    GRANT ALL PRIVILEGES ON lexflow.* TO 'lexflow'@'%';
    GRANT ALL PRIVILEGES ON lexflow.* TO 'lexflow'@'localhost';
    FLUSH PRIVILEGES;
  " 2>/dev/null || sudo "$mysql_bin" -uroot -e "
    CREATE DATABASE IF NOT EXISTS lexflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'lexflow'@'%' IDENTIFIED BY 'lexflow';
    CREATE USER IF NOT EXISTS 'lexflow'@'localhost' IDENTIFIED BY 'lexflow';
    GRANT ALL PRIVILEGES ON lexflow.* TO 'lexflow'@'%';
    GRANT ALL PRIVILEGES ON lexflow.* TO 'lexflow'@'localhost';
    FLUSH PRIVILEGES;
  "
}

ensure_env() {
  if [[ ! -f .env ]]; then
    echo "[cloud-start] Creating .env from .env.example"
    cp .env.example .env
    # Prefer a non-placeholder JWT for local cloud runs
    if grep -q 'JWT_SECRET=change-me-to-a-long-random-string' .env; then
      local secret
      secret="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
      sed -i "s/JWT_SECRET=change-me-to-a-long-random-string/JWT_SECRET=${secret}/" .env
    fi
  fi
}

start_mariadb || true
ensure_database || true
ensure_env

echo "[cloud-start] Ready. DATABASE_URL default: mysql://lexflow:lexflow@127.0.0.1:3306/lexflow"
