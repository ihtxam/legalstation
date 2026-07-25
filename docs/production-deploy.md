# Production deploy recipe

LexFlow needs **Node 22+**, **MySQL 8 / MariaDB**, and HTTPS for OAuth cookies.

**Hetzner VPS step-by-step:** see [`docs/hetzner-deploy.md`](./hetzner-deploy.md) (`scripts/hetzner-deploy.sh`).

## Quick path: Docker Compose

```bash
cp .env.example .env
# set JWT_SECRET, OAuth vars, and optional BREVO_API_KEY / Stripe

docker compose -f docker-compose.prod.yml up -d --build
# then from a one-off job or local machine with DATABASE_URL pointing at the container:
pnpm db:push
# optional online demo users (never enable on a real client site without care):
# DEMO_AUTH_ENABLED=true DEMO_AUTH_ALLOW_PRODUCTION=true pnpm seed:demo
```

App listens on `http://localhost:3000` (put a reverse proxy + TLS in front).

## Railway / Render / Fly

1. Provision MySQL and set `DATABASE_URL`.
2. Set secrets from `.env.example` (`JWT_SECRET`, Manus OAuth, etc.).
3. Build command: `pnpm install --frozen-lockfile && pnpm build`
4. Release / migrate: `pnpm db:push` (or `drizzle-kit migrate`)
5. Start: `pnpm start`
6. OAuth redirect URI: `https://YOUR_DOMAIN/api/oauth/callback`

## Production Dockerfile

`Dockerfile` builds the Vite client + bundled Express server into `dist/`, then runs `node dist/index.js`.

```bash
docker build -t lexflow:latest .
docker run --env-file .env -p 3000:3000 lexflow:latest
```

## Demo / online testing without Manus OAuth

```bash
DEMO_AUTH_ENABLED=true pnpm seed:demo
DEMO_AUTH_ENABLED=true pnpm dev
# open / → use Demo login buttons, or:
curl -X POST http://localhost:3000/api/demo/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@demo.lexflow.ch"}' -c /tmp/lexflow.cookies
```

Never set `DEMO_AUTH_ALLOW_PRODUCTION=true` on a real customer deployment.

See also: `docs/online-testing.md`.
