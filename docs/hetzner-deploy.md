# Deploy Cliavo on a Hetzner server

This guide targets a single **Hetzner Cloud** VPS (CX22 / CPX21 or larger) in a Swiss or EU location (`fsn1`, `nbg1`, or `hel1`). Prefer **Falkenstein (`fsn1`)** or **Nuremberg (`nbg1`)** for Swiss/EU data residency claims.

## 1. Create the server

1. [Hetzner Cloud Console](https://console.hetzner.cloud/) → New Project → Add Server
2. Location: `fsn1` or `nbg1`
3. Image: **Ubuntu 24.04**
4. Type: **CX22** (2 vCPU / 4 GB) minimum; **CPX31** if you expect heavier AI/PDF load
5. Networking: public IPv4 (+ IPv6 optional)
6. SSH key: add your public key
7. Create server → note the public IP

Open ports in the Hetzner firewall (or `ufw` on the host):

| Port | Purpose |
|------|---------|
| 22 | SSH |
| 80 | HTTP (Let's Encrypt / redirect) |
| 443 | HTTPS |

## 2. Initial host setup

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y
apt install -y curl git ufw fail2ban ca-certificates

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Optional non-root user
adduser --disabled-password --gecos "" cliavo
usermod -aG docker,sudo cliavo
```

## 3. Clone and configure

```bash
su - cliavo
git clone https://github.com/ihtxam/legalstation.git
cd legalstation
cp .env.example .env
nano .env
```

Minimum production values:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://cliavo:STRONG_DB_PASSWORD@mysql:3306/cliavo
JWT_SECRET=LONG_RANDOM_SECRET
DEPLOYMENT_MODE=saas
# or: DEPLOYMENT_MODE=on_premise + LICENSE_KEY for single-tenant

# Manus OAuth (real login)
VITE_APP_ID=...
VITE_OAUTH_PORTAL_URL=...
OAUTH_SERVER_URL=...

# Optional
BREVO_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
BUILT_IN_FORGE_API_URL=...
BUILT_IN_FORGE_API_KEY=...
ADYEN_API_KEY=...
ADYEN_MERCHANT_ACCOUNT=...
ADYEN_ENVIRONMENT=test

# Never enable on a real client host
DEMO_AUTH_ENABLED=false
DEMO_AUTH_ALLOW_PRODUCTION=false
```

Also set `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` for Compose.

## 4. Deploy with Docker Compose

```bash
# From the repo root as user cliavo
export MYSQL_PASSWORD='STRONG_DB_PASSWORD'
export MYSQL_ROOT_PASSWORD='STRONG_ROOT_PASSWORD'
export JWT_SECRET='LONG_RANDOM_SECRET'

docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# Apply migrations (one-shot)
docker compose -f docker-compose.prod.yml run --rm app \
  sh -c "pnpm exec drizzle-kit migrate || true"
# Prefer running migrate from a machine that has drizzle-kit, or use:
# docker compose exec app node -e "..." 
# Simplest reliable path from your laptop with DATABASE_URL pointed at the server tunnel:
pnpm db:push
```

Or use the helper script:

```bash
bash scripts/hetzner-deploy.sh
```

## 5. HTTPS with Caddy (recommended)

Point your DNS `A` record for `app.yourdomain.ch` to the server IP, then:

```bash
# as root
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

cat >/etc/caddy/Caddyfile <<'EOF'
app.yourdomain.ch {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF

systemctl reload caddy
```

Configure Manus OAuth redirect URI to:

`https://app.yourdomain.ch/api/oauth/callback`

Stripe webhook endpoint:

`https://app.yourdomain.ch/api/stripe/webhook`

## 6. Backups (compliance ops)

```bash
# Daily MySQL dump (example cron as cliavo)
crontab -e
# 0 2 * * * docker exec cliavo-mysql-1 mysqldump -ucliavo -p"$MYSQL_PASSWORD" cliavo | gzip > /home/cliavo/backups/cliavo-$(date +\%F).sql.gz
```

Store copies offsite (Hetzner Storage Box, S3-compatible, or another region). See `docs/backup-policy.md`.

## 7. Smoke check

```bash
curl -I https://app.yourdomain.ch/
# Optional demo only on a throwaway host:
# DEMO_AUTH_ENABLED=true DEMO_AUTH_ALLOW_PRODUCTION=true pnpm seed:demo
```

## 8. On-premise / single-tenant mode

```env
DEPLOYMENT_MODE=on_premise
SINGLE_TENANT=true
LICENSE_KEY=...
LICENSE_SIGNING_SECRET=...
DATA_RESIDENCY=CH
```

## Ops checklist

- [ ] Firewall + fail2ban
- [ ] HTTPS + OAuth redirect
- [ ] Automated DB backups + restore test
- [ ] Stripe/Adyen webhooks on HTTPS
- [ ] SIEM export via Admin → Audit log (`/audit`)
- [ ] Disable `DEMO_AUTH_*` on production
- [ ] Review `docs/toms.md` and `docs/pentest-checklist.md`

More generic compose notes: `docs/production-deploy.md`.
