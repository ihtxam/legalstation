# Encryption at Rest — LexFlow Configuration Guide

## Database (MySQL / MariaDB)
LexFlow uses MySQL via Drizzle. Enable encryption at the infrastructure layer:

1. Set `DB_ENCRYPTION_AT_REST=true` so the app reports encryption as configured.
2. On managed MySQL: enable provider TDE / storage encryption.
3. On self-hosted MariaDB/MySQL: configure InnoDB encryption / encrypted tablespaces and key management per vendor docs.

> Note: Application-level column encryption is not enabled by default.

## Object storage (documents)
Uploads go through the Forge/S3-compatible storage layer.

| Env var | Purpose |
|---------|---------|
| `S3_SSE_MODE` | `AES256` (SSE-S3) or `aws:kms` |
| `S3_KMS_KEY_ID` | KMS key ARN/id when using SSE-KMS |

Ensure the bucket policy denies unencrypted `PutObject`.

## Per-tenant DEK / KEK
Optional envelope encryption helpers live in `server/license.ts` (`wrapTenantDek` / `unwrapTenantDek`).

| Env var | Purpose |
|---------|---------|
| `TENANT_DEK_ENABLED` | Feature flag |
| `TENANT_KEK` | Base64 key-encryption-key |

When enabled in a future storage path, each firm DEK is wrapped with the KEK before persistence. Rotate KEK with a re-wrap procedure; never store DEKs in plaintext logs.

## Verification
- `GET`/`trpc` `system.health` and `deployment.info` expose encryption flags for operators (no secrets).
