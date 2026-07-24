# Swiss Data Processing Agreement (DPA) — LexFlow Template

**Status:** Template for counsel review · Not legal advice  
**Languages:** English (reference) · Français · Deutsch  
**Governing law:** Swiss Federal Act on Data Protection (nFADP / nDSG)

---

## 1. Parties / Parties / Parteien

- **Controller / Responsable du traitement / Verantwortlicher:** [Law firm legal name], [address], Switzerland  
- **Processor / Sous-traitant / Auftragsbearbeiter:** LexFlow operator / on-premise licensee as applicable  

---

## 2. Subject matter / Objet / Gegenstand

Processing of personal data of firm members, clients, and related case contacts for legal practice management (cases, documents, messaging, billing, time tracking).

**FR:** Traitement des données personnelles des collaborateurs, clients et contacts liés aux mandats.  
**DE:** Bearbeitung personenbezogener Daten von Mitarbeitenden, Klienten und mandatbezogenen Kontakten.

---

## 3. Categories of data / Catégories / Kategorien

| Category | Examples |
|----------|----------|
| Identity | Name, email, phone, address, UID/VAT |
| Case data | Case titles, notes, deadlines, assignments |
| Documents | Uploaded files, versions, summaries |
| Communications | In-app messages, notification metadata |
| Billing | Invoices, payment status, time entries |
| Technical | IP address, user agent (audit logs) |

Special categories (health, biometric, etc.) only if the firm uploads them; firm remains controller.

---

## 4. Purposes / Finalités / Zwecke

- Provide LexFlow SaaS or on-premise software  
- Authenticate users and enforce RBAC  
- Store and exchange case documents  
- Generate invoices and payment links  
- Security, audit, and abuse prevention  

---

## 5. Location / Lieu / Standort

Default data residency: **Switzerland (CH)** (`DATA_RESIDENCY=CH`).  
Sub-processors and hosting regions must be listed in Annex A and kept current.

---

## 6. Security / Sécurité / Sicherheit

Processor implements TOMs described in `docs/toms.md`, including encryption in transit, access control, logging, backups, and vulnerability management.

---

## 7. Sub-processors / Sous-traitants / Unterauftragsbearbeiter

SaaS: listed in Annex A (e.g. hosting, email, payments, object storage).  
On-premise: firm controls infrastructure; LexFlow vendor may only receive support telemetry if contractually agreed.

---

## 8. International transfers / Transferts / Übermittlungen

If data leaves Switzerland/EEA, transfers rely on adequacy decisions or SCCs + Swiss addendum, documented in Annex B.

---

## 9. Retention / Conservation / Aufbewahrung

Controller defines retention. Default operational retention: active subscription + [X] years after termination for legal holds, unless earlier deletion is requested and lawful.

---

## 10. Data subject rights / Droits / Betroffenenrechte

Processor assists Controller with access, rectification, deletion, portability, and objection requests within agreed SLAs.

---

## 11. Breach notification / Violation / Verletzung

Processor notifies Controller without undue delay and no later than **72 hours** after becoming aware of a personal data breach.

---

## 12. Audit / Audit / Prüfung

Controller may audit (or appoint an auditor) once per year with 30 days’ notice, or after a material incident, under confidentiality.

---

## Annex A — Sub-processors

| Name | Service | Location |
|------|---------|----------|
| [Hosting] | Compute/DB | CH / EU |
| [Object storage] | Documents | CH / EU |
| [Email] | Transactional mail | … |
| [Payments] | Stripe / Adyen | … |

## Annex B — Transfer tools

[Adequacy / SCCs / Swiss addendum references]
