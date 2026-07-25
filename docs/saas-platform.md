# LexFlow SaaS platform guide

## Login URLs

| Audience | URL | Notes |
|----------|-----|--------|
| Firm staff & clients | `/login` | Email + password. Superadmins are rejected here. |
| Platform superadmin | `/platform/login` | Superadmins only. Firm/client accounts are rejected. |
| Marketing landing | `/` | Links to workspace login + platform login. |

## First platform superadmin

1. Set `SUPERADMIN_BOOTSTRAP_SECRET` in the server `.env`.
2. Open `/platform/login` → **First-time bootstrap**.
3. Enter email, password, and the bootstrap secret.
4. Remove or rotate `SUPERADMIN_BOOTSTRAP_SECRET` after use.

There is **no** “become superadmin” button in firm dashboards.

## Provisioning a law firm

From `/superadmin`:

1. **Create Firm** — name, owner email, optional subdomain slug, plan, currency/VAT.
2. Check **Send login credentials email now** (or click **Send credentials** later).
3. Owner signs in at `/login`, changes temporary password, completes `/firm-onboarding`
   (profile → branding → currency/tax → subdomain).
4. Optionally **Activate subdomain** when DNS is ready.

### Subdomains / custom domains

- Firm slug is unique (e.g. `mueller-partner`).
- Set `APP_BASE_DOMAIN` (e.g. `webprintmedia.swiss`) so login links become
  `https://{slug}.{APP_BASE_DOMAIN}/login`.
- Set `APP_URL` for email links when not using subdomains yet
  (e.g. `https://legal.webprintmedia.swiss`).
- Custom domains are stored on the firm and resolved from the `Host` header when
  `subdomainStatus = active`.

Nginx / DNS (example):

```
# DNS
*.webprintmedia.swiss  A  YOUR_SERVER_IP

# Nginx server_name
server_name legal.webprintmedia.swiss *.webprintmedia.swiss;
```

## Time tracking

- Case detail → **Time** tab: start/pause/resume/stop web timer, manual entry, edit/delete.
- Global floating timer persists across pages (server-side `active_timers`).
- Time Reports (`/time-reports`) for billing workflows.

## Roles

| Layer | Values | Access |
|-------|--------|--------|
| Platform `users.role` | `user`, `admin`, `superadmin` | Only `superadmin` uses `/platform` + `/superadmin` |
| Firm `firmMembers.firmRole` | `admin`, `lawyer`, `assistant` | Firm workspace |
| Client | `clients.userId` link | Client portal |

Clients and firm users cannot elevate to platform superadmin.
