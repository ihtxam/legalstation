# Technical and Organizational Measures (TOMs) — Cliavo

Aligned with Swiss nFADP Art. 8 and common ISO 27001 control themes.

## 1. Access control
- Role-based access (superadmin, firm admin, lawyer, assistant, client)
- Session cookies signed with `JWT_SECRET`
- Firm-scoped queries on all tenant data
- On-premise single-tenant mode blocks additional firm creation

## 2. Encryption
- **In transit:** TLS for web/API traffic
- **At rest (DB):** enable MySQL/MariaDB tablespace encryption (`DB_ENCRYPTION_AT_REST=true` + infra config)
- **At rest (objects):** S3 SSE (`S3_SSE_MODE=AES256` or `aws:kms` + `S3_KMS_KEY_ID`)
- **Per-tenant keys:** optional DEK wrapped by KEK (`TENANT_DEK_ENABLED`, `TENANT_KEK`)

## 3. Logging & monitoring
- Document audit log (view/download/upload/delete/version)
- SIEM export via `deployment.exportAuditLog` (JSON event schema `cliavo.audit.v1`)
- Application and access logs retained per ops policy

## 4. Availability & backups
- See `docs/backup-policy.md`
- Restore tests at least quarterly
- Offsite encrypted copies in a second Swiss/EU region when SaaS

## 5. Development & change management
- Code review / PR process
- Dependency updates and vulnerability scanning
- Secrets never committed (`.env` gitignored; Cloud Agent Secrets)

## 6. Vendor & subprocessors
- Maintain Annex A of DPA
- Contractual security requirements for hosting, email, payments

## 7. Incident response
- Detect → contain → eradicate → recover → notify
- Controller notified ≤ 72h for personal data breaches
- Post-incident review and TOM updates

## 8. Personnel
- Least-privilege production access
- Confidentiality agreements for staff with data access
- Offboarding checklist for credential revocation
