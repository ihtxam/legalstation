# LexFlow — Project TODO

## Phase 1: Foundation
- [x] Design system: Inter + Playfair Display fonts, navy/slate/gold palette, CSS variables
- [x] Database schema: 16 tables (firms, firmMembers, invitations, clients, cases, caseAssignments, caseEvents, documentFolders, documents, documentVersions, documentAuditLog, messages, messageReads, invoices, invoiceItems, users)
- [x] Run drizzle-kit generate and apply migrations
- [x] Core server infrastructure: tRPC router split by feature, role guards, db helpers
- [x] Shared types and constants (roles, case types, invoice statuses, Swiss VAT rates)

## Phase 2: Auth & Landing
- [x] Landing page: elegant hero, feature highlights, CTA to sign in
- [x] Manus OAuth login flow wired to tenant + role context
- [x] Firm onboarding: create firm/workspace after first login (admin)
- [x] Invite flow: admin invites lawyers/assistants; lawyers invite clients via email token
- [x] Role-based route guards on frontend
- [x] LexLayout sidebar with role-aware navigation (firm member vs client views)

## Phase 3: Client Management
- [x] Client list page with search and filter (by type: individual/company, status)
- [x] Create client profile form (individual and company branches)
- [x] Client invitation by email with onboarding link
- [x] Client onboarding flow: accept terms, complete profile
- [x] Client detail page with profile and notes tabs

## Phase 4: Case Management
- [x] Case list page with open/closed tabs, search, status filter
- [x] Create case form: title, reference number, type, status, description, deadline
- [x] Case detail page with tabs: Timeline, Documents, Messages
- [x] Case timeline: chronological event log, notes, status changes
- [x] Internal notes (lawyer-only) vs shared notes (client-visible)
- [x] Case status transitions with timeline events
- [ ] Assign/unassign clients and lawyers UI in case detail (backend ready)

## Phase 5: Document Management
- [x] Document upload to S3 via /api/upload endpoint (multer + storagePut)
- [x] Per-case folder structure (create folders, assign documents)
- [x] Visibility toggle per document (internal / shared with client)
- [x] Basic versioning: keep last 3 versions (pruneOldVersions)
- [x] Client document upload
- [x] Audit log: record every download (actor, action, timestamp)
- [ ] Audit log viewer page for admins
- [ ] Version history viewer UI

## Phase 6: Messaging
- [x] In-app threaded messaging per case
- [x] Message read receipts (markMessageRead)
- [ ] Email notification on new message (requires email provider)
- [ ] Email notification on new document upload
- [x] Unread message count badge in sidebar

## Phase 7: Billing & Payments
- [x] Invoice creation tied to a case (line items: hourly or flat fee)
- [x] Swiss VAT/TVA handling (7.7% standard, 2.5% reduced, 3.7% special, 0% exempt)
- [x] Invoice statuses: draft, sent, paid, overdue, cancelled
- [x] Print/PDF via browser print dialog (print styles added)
- [x] Invoice list for lawyers with status filters
- [x] Client invoice view: outstanding balance on dashboard
- [x] Stripe Checkout integration: payment link per invoice
- [x] Stripe webhook: checkout.session.completed → mark invoice paid
- [ ] Server-side PDF generation with firm letterhead

## Phase 8: Dashboards
- [x] Lawyer dashboard: open/pending cases, pending/overdue invoices, total revenue
- [x] Lawyer dashboard: upcoming deadlines widget
- [x] Lawyer dashboard: recent activity feed (last 10 case events)
- [x] Client dashboard: my cases, open cases, unread messages, outstanding bills
- [x] Client dashboard: outstanding balance card with CTA
- [ ] Admin dashboard: firm overview, all lawyers, revenue summary

## Phase 9: Polish & Tests
- [x] Vitest: auth.logout, auth.me, Swiss VAT, invoice number format, RBAC logic (10 tests)
- [x] TypeScript: zero errors across all files
- [x] Empty states for all lists (cases, clients, invoices, messages, documents)
- [x] Loading skeletons throughout
- [x] Error boundary and 404 handling
- [x] Print styles for invoice PDF
