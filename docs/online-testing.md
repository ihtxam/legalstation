# How to test Cliavo online

Cliavo is a full-stack app (Express + Vite + MySQL). You need a Node host and MySQL.

## Option A — Demo login (fastest, no Manus OAuth)

1. Ensure MySQL is running and migrations applied (`pnpm setup` or `pnpm db:push`).
2. Enable demo auth and seed users:

```bash
export DEMO_AUTH_ENABLED=true
pnpm seed:demo
pnpm dev
```

3. Open the app (port **3000**). On the landing page, use **Demo login** as Admin / Lawyer / Client.
4. For a public URL: expose with Cloudflare Tunnel / ngrok, or deploy with `DEMO_AUTH_ENABLED=true` and (only on a throwaway host) `DEMO_AUTH_ALLOW_PRODUCTION=true`.

Demo accounts:

| Role   | Email |
|--------|-------|
| Admin  | `admin@demo.cliavo.ch` |
| Lawyer | `lawyer@demo.cliavo.ch` |
| Client | `client@demo.cliavo.ch` |

## Option B — Cursor Cloud Agent

1. Merge the cloud setup so agents get Node + MariaDB.
2. Set secrets: `JWT_SECRET`, `DATABASE_URL` (or local MariaDB), optional OAuth / Brevo.
3. Run `DEMO_AUTH_ENABLED=true pnpm seed:demo && DEMO_AUTH_ENABLED=true pnpm dev`.
4. Open the forwarded URL for port **3000**.

## Option C — Public host (Railway / Render / Fly.io)

See `docs/production-deploy.md`. Point Manus OAuth redirect to `https://YOUR_DOMAIN/api/oauth/callback`. Use HTTPS so session cookies work.

## Option D — Local + tunnel + real OAuth

```bash
bash scripts/dev-setup.sh
pnpm dev
# cloudflared tunnel --url http://localhost:3000
```

## Smoke checklist

- [ ] Landing page loads (EN / FR / DE via Settings after login)
- [ ] Demo login as admin → Dashboard, Cases, Clients, Invoices
- [ ] Demo login as client → Client portal / My Cases
- [ ] Upload document → analysis starts (needs Forge keys)
- [ ] Send message (email needs Brevo)
- [ ] Create invoice → Download PDF
- [ ] Admin → `/analytics` and `/audit`

## Automated smoke

```bash
DEMO_AUTH_ENABLED=true pnpm test:smoke
```

This seeds demo data (when DB is up) and exercises firm / cases / clients flows via tRPC callers.
