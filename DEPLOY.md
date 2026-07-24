# LexFlow deployment

Two environments:

1. **Cloud / local testing** — `docker compose up` (MySQL + MinIO + app)
2. **Hetzner production** — same stack + Caddy TLS reverse proxy

## Prerequisites

- Docker Engine 24+ with Compose v2
- For Hetzner: a VPS with a DNS `A`/`AAAA` record pointing at the server

## 1) Cloud / local testing

```bash
cp .env.example .env
# optional: edit JWT_SECRET, ports, etc.
docker compose up -d --build
curl -s http://localhost:3000/api/health | jq
```

Open http://localhost:3000 — with `ENABLE_DEV_LOGIN=true` use **Dev sign-in** on the landing page.

Useful:

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| MySQL | localhost:3306 |

## 2) Hetzner production

### First-time server bootstrap

```bash
# on the VPS as root
curl -fsSL https://raw.githubusercontent.com/ihtxam/legalstation/main/deploy/hetzner-bootstrap.sh | bash
git clone https://github.com/ihtxam/legalstation.git /opt/lexflow
cd /opt/lexflow
cp .env.example .env.production
```

Edit `.env.production` at minimum:

```env
DOMAIN=legal.yourdomain.com
ACME_EMAIL=ops@yourdomain.com
JWT_SECRET=<long-random-secret>
MYSQL_ROOT_PASSWORD=<strong>
MYSQL_PASSWORD=<strong>
S3_ACCESS_KEY_ID=<strong>
S3_SECRET_ACCESS_KEY=<strong>
ENABLE_DEV_LOGIN=false
PUBLIC_APP_URL=https://legal.yourdomain.com
S3_PUBLIC_URL=https://legal.yourdomain.com/manus-storage
DEPLOYMENT_MODE=saas
STORAGE_BACKEND=s3
```

Point DNS to the VPS, then:

```bash
bash deploy/hetzner-deploy.sh
```

### GitHub Actions CD

Add repository secrets:

| Secret | Description |
|--------|-------------|
| `HETZNER_HOST` | VPS IP or hostname |
| `HETZNER_USER` | SSH user (e.g. `root` or `deploy`) |
| `HETZNER_SSH_KEY` | Private key with deploy access |
| `HETZNER_PORT` | Optional, default `22` |
| `HETZNER_APP_DIR` | Optional, default `/opt/lexflow` |

Push to `main` or run **Deploy to Hetzner** manually. The workflow no-ops the SSH job until `HETZNER_HOST` is set; the image smoke build always runs.

## Environment notes

| Variable | Purpose |
|----------|---------|
| `DEPLOYMENT_MODE` | `saas` or `on_premise` |
| `STORAGE_BACKEND` | `s3` (MinIO/S3), `local`, or `forge` (Manus) |
| `ENABLE_DEV_LOGIN` | Temporary email login for testing — **off in production** |
| `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL` | Manus OAuth when not using dev login |

## Smoke checklist

1. `GET /api/health` → `ok: true`, `database: "ok"`
2. Landing page loads
3. Dev login (test) or OAuth (prod) reaches `/dashboard`
4. Upload a document (S3/MinIO path `/manus-storage/...`)
5. HTTPS + valid cert on Hetzner (`https://$DOMAIN`)
