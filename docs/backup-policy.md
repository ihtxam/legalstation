# Backup Encryption & Offsite Policy — LexFlow

## Objectives
- RPO (Recovery Point Objective): ≤ 24 hours (target ≤ 4 hours for SaaS production)
- RTO (Recovery Time Objective): ≤ 8 hours for production restore

## What is backed up
1. MySQL/MariaDB logical dumps + binary logs (or managed snapshot equivalents)
2. Object storage (documents) via versioning + cross-region replication or periodic sync
3. Configuration secrets vault metadata (not raw secrets in plaintext backups)

## Encryption
- Backups encrypted at rest with AES-256 (or cloud provider KMS)
- Keys stored separately from backup media
- Transfer to offsite location over TLS

## Offsite / secondary copy
- At least one copy in a second availability zone or region
- Preferred residency: Switzerland or EU (document any exception)
- On-premise: customer maintains offsite copy per this policy or their own ISO-aligned policy

## Retention
| Backup type | Retention |
|-------------|-----------|
| Daily | 14–30 days |
| Weekly | 12 weeks |
| Monthly | 12 months |

Legal hold overrides retention when required by the controller.

## Testing
- Restore drill at least quarterly
- Document results, gaps, and remediation owners
