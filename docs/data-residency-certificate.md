# Data Residency Certificate — Cliavo

**Certificate ID:** DR-[YYYY]-[NNNN]  
**Issued to:** [Customer / Law firm]  
**Issued by:** [Cliavo operator]  
**Valid from:** [date] **to:** [date]

## Declaration

We certify that, for the Cliavo environment identified below, primary application data (database and document object storage) is configured to reside in:

- **Primary region:** Switzerland (`DATA_RESIDENCY=CH`)
- **Deployment mode:** ☐ SaaS multi-tenant ☐ On-premise single-tenant
- **Environment / tenant ID:** [id]

## Scope

Includes: MySQL/MariaDB application database, document object storage, application logs retained in the primary region.

Excludes (unless separately agreed): end-user devices, customer email systems, payment processors’ own PCI environments, and any customer-configured external integrations.

## Subprocessors in scope

| Subprocessor | Role | Region |
|--------------|------|--------|
| … | … | CH / EU |

## Controls

- Logical tenant isolation (SaaS) or single-tenant deployment (on-prem)
- Encryption in transit (TLS) and at rest as documented in `docs/toms.md`
- Access restricted to authorized operators under least privilege

## Signature

Name: ______________________  
Title: ______________________  
Date: ______________________  
Signature / stamp: ______________________
