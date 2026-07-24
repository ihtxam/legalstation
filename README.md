# LexFlow (LegalStation)

Swiss legal practice management platform — multi-tenant SaaS for law firms: cases, documents, messaging, billing, time tracking, and client portal.

Stack: **React 19 + Vite + tRPC + Express + Drizzle ORM + MySQL**.

## Quick start

```bash
# 1) Dependencies + .env (+ MySQL if Docker is available)
bash scripts/dev-setup.sh

# 2) Dev server (http://localhost:3000)
pnpm dev
```

Or step by step:

```bash
pnpm install
cp .env.example .env   # fill secrets
docker compose up -d mysql
pnpm db:push
pnpm dev
```

## Scripts

| Command | Purpose |
|--------|---------|
| `pnpm dev` | Express + Vite development server |
| `pnpm build` | Production client + server build |
| `pnpm start` | Run production build |
| `pnpm check` | TypeScript (`tsc --noEmit`) |
| `pnpm test` | Vitest unit tests |
| `pnpm db:push` | Generate + apply Drizzle migrations |
| `pnpm format` | Prettier |

## Environment variables

See [`.env.example`](.env.example). Minimum for a useful local session:

- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — session cookie signing
- OAuth (`VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`) for real login
- Optional: `BREVO_API_KEY`, `STRIPE_*`, Forge API keys for uploads / AI / maps

## Cursor Cloud Agents

This repo includes a committed cloud environment:

- [`.cursor/environment.json`](.cursor/environment.json) — install / start / terminals / ports
- [`.cursor/Dockerfile`](.cursor/Dockerfile) — Node 22 + pnpm + MariaDB
- [`scripts/cloud-start.sh`](scripts/cloud-start.sh) — start MariaDB and seed local DB credentials
- [`scripts/dev-setup.sh`](scripts/dev-setup.sh) — idempotent dependency install

**Secrets** (set in [Cloud Agents dashboard](https://cursor.com/dashboard) → Secrets; do not commit):

- `DATABASE_URL` (optional override; cloud image defaults to local MariaDB)
- `JWT_SECRET`
- `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`
- `BREVO_API_KEY`, `STRIPE_SECRET_KEY`, Forge keys as needed

After the environment image builds once, agents will:

1. `pnpm install --frozen-lockfile`
2. Start MariaDB and ensure the `lexflow` database exists
3. Launch `pnpm dev` on port **3000**

## Project layout

```
client/     React SPA (Wouter, TanStack Query, shadcn/ui)
server/     Express + tRPC routers, auth, Stripe/Adyen, email
shared/     Shared types/constants
drizzle/    MySQL schema + migrations
```

## What’s next

Open items live in [`todo.md`](todo.md). Highest-value remaining work:

1. Server-side invoice PDF with firm letterhead
2. Auto-generate scheduled invoices from payment plans
3. Time entry → invoice integration + submission workflow
4. Deployment modes (`saas` / `on_premise`) and Swiss DPA / TOMs docs
5. Broader document-analysis testing (PDF / Word / text)
