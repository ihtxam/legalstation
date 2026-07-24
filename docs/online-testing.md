# How to test LexFlow online

LexFlow is a full-stack app (Express + Vite + MySQL). There is no Vercel/static-only deploy — you need a Node host and a MySQL database.

## Option A — Cursor Cloud Agent (quickest for this repo)

1. Merge the cloud setup PR (`.cursor/environment.json`) so agents get Node + MariaDB.
2. Open a Cloud Agent on the repo at [cursor.com/agents](https://cursor.com/agents).
3. Ask the agent to run `pnpm setup` / `pnpm dev`.
4. Use the **Ports** panel to open the forwarded URL for port **3000**.
5. Add secrets in the Cloud Agents dashboard:
   - `JWT_SECRET`, `DATABASE_URL` (or use local MariaDB from the image)
   - Manus OAuth: `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`
   - Optional: `BREVO_API_KEY`, Stripe/Adyen, Forge API keys

> Login will only work once Manus OAuth env vars are set. Without them you can still load the landing page and run `pnpm test`.

## Option B — Public host (Railway / Render / Fly.io)

1. Provision **MySQL 8** (or MariaDB).
2. Set env vars from `.env.example` (at minimum `DATABASE_URL`, `JWT_SECRET`, OAuth vars).
3. Build & start:

```bash
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pnpm start
```

4. Point your domain at the service; ensure HTTPS so OAuth cookies (`SameSite=None; Secure`) work.
5. Configure Manus OAuth redirect URI to `https://YOUR_DOMAIN/api/oauth/callback`.

## Option C — Local + tunnel

```bash
bash scripts/dev-setup.sh
pnpm dev
# then expose with Cloudflare Tunnel / ngrok:
# cloudflared tunnel --url http://localhost:3000
```

Use the HTTPS tunnel URL as the OAuth redirect base.

## Smoke checklist

- [ ] Landing page loads
- [ ] Sign-in (Manus OAuth)
- [ ] Create firm / accept invite
- [ ] Create client + case + assignment
- [ ] Upload document → AI analysis starts
- [ ] Send message → email attempt (needs Brevo)
- [ ] Create invoice → Download PDF
- [ ] Time entry → submit → invoice
- [ ] Settings → language FR/DE/EN + optional 2FA
- [ ] Admin → `/analytics` and `/audit`
