# Compliance operations (runtime)

Swiss DPA / TOMs templates live under `docs/`. This page lists **what the product implements today** vs **what operators must run**.

## Implemented in LexFlow

| Control | Where |
|---------|--------|
| Role-based access (firm vs client) | `server/access.ts`, tRPC routers |
| Document audit trail + SIEM export | Admin → `/audit` → `deployment.exportAuditLog` |
| Deployment mode saas / on_premise | `DEPLOYMENT_MODE`, `server/deployment.ts` |
| Single-tenant + offline license | `LICENSE_*`, `server/license.ts` |
| Optional TOTP 2FA | Settings → Security |
| Stripe webhook marks invoices paid (firm-scoped metadata) | `POST /api/stripe/webhook` |
| Adyen payment links + HMAC helper | `ADYEN_*`, `server/adyen.ts` |
| Data residency flag | `DATA_RESIDENCY` (default `CH`) |

## Operator responsibilities (not automated)

| Control | Action |
|---------|--------|
| Encryption at rest | Enable MySQL/MariaDB TDE or volume encryption on Hetzner; S3 SSE (`S3_SSE_MODE`) |
| Backups + offsite | Daily dumps + Storage Box / second region — `docs/backup-policy.md` |
| TLS termination | Caddy/Nginx on the VPS — `docs/hetzner-deploy.md` |
| Pen-test | Run against staging — `docs/pentest-checklist.md` |
| DPA with clients | Customize `docs/swiss-dpa-template.md` |
| Demo auth | Keep `DEMO_AUTH_ENABLED=false` on production |
| Forge / Brevo secrets | Rotate and store in a vault; never commit |

## SIEM export usage

1. Sign in as firm admin
2. Open **Audit log** (`/audit`)
3. Export JSON (`lexflow.audit.v1`) into your SIEM pipeline

Current export covers **document** access events (upload/view/download/delete). Auth and payment events should be scraped from reverse-proxy / Stripe / Adyen logs until those streams are unified.

## Hetzner checklist

See `docs/hetzner-deploy.md` for host hardening, Compose deploy, Caddy TLS, and backup cron.
