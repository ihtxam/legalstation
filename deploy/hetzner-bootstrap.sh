#!/usr/bin/env bash
# First-time setup on a fresh Hetzner Ubuntu/Debian VPS.
# Run as root (or with sudo): bash deploy/hetzner-bootstrap.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

APP_DIR="${APP_DIR:-/opt/lexflow}"
mkdir -p "${APP_DIR}"
echo "Bootstrap complete. Clone the repo into ${APP_DIR} and copy .env.production."
echo "Then: cd ${APP_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build"
