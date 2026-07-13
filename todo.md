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
- [x] Assign/unassign clients and lawyers UI in case detail (backend ready)

## Phase 5: Document Management
- [x] Document upload to S3 via /api/upload endpoint (multer + storagePut)
- [x] Per-case folder structure (create folders, assign documents)
- [x] Visibility toggle per document (internal / shared with client)
- [x] Basic versioning: keep last 3 versions (pruneOldVersions)
- [x] Client document upload
- [x] Audit log: record every download (actor, action, timestamp)
- [x] Audit log viewer page for admins (ready for integration)
- [x] Version history viewer UI (ready for integration)

## Phase 6: Messaging
- [x] In-app threaded messaging per case
- [x] Message read receipts (markMessageRead)
- [x] Email notification on new message (Brevo integration)
- [x] Email notification on new document upload (Brevo integration)
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
- [x] Admin dashboard: lawyer dashboard serves as the admin view for MVP (full admin analytics is post-MVP)

## Phase 9: Polish & Tests
- [x] Vitest: auth.logout, auth.me, Swiss VAT, invoice number format, RBAC logic (10 tests)
- [x] TypeScript: zero errors across all files
- [x] Empty states for all lists (cases, clients, invoices, messages, documents)
- [x] Loading skeletons throughout
- [x] Error boundary and 404 handling
- [x] Print styles for invoice PDF

## Post-MVP Enhancements
- [ ] Email notifications for messages and document uploads (requires email provider)
- [ ] 2FA optional login
- [ ] Multi-language UI (FR / DE / EN)
- [ ] Case assignment UI (add/remove lawyers and clients in case detail)
- [ ] Document version history viewer UI
- [ ] Audit log viewer page for admins
- [ ] Invoice PDF with firm letterhead (server-side generation)
- [ ] Full admin analytics dashboard

## Critical MVP Fixes (Phase 10)
- [x] Brevo API integration: send firm invite, client invite, and message notification emails
- [x] Case assignment UI: add/remove clients and lawyers from case detail page
- [x] Test case assignment workflow end-to-end

## Deployment & Data Protection (Phase 11)
- [ ] Deployment mode support: DEPLOYMENT_MODE env flag (saas | on_premise)
- [ ] Single-tenant mode for on-prem deployments
- [ ] License module for on-prem (offline validation, grace period)
- [ ] Encryption at rest configuration (Postgres TDE, S3 SSE)
- [ ] Per-tenant data encryption keys (DEK/KEK)
- [ ] Audit log export for SIEM integration
- [ ] Swiss DPA template (FR/DE bilingual)
- [ ] Technical & organizational measures (TOMs) documentation
- [ ] Data residency certificate template
- [ ] Backup encryption + offsite policy
- [ ] Penetration test readiness checklist
- [ ] Sales sheet for Swiss law firms


## Phase 4: SaaS Multi-Tenant & Superadmin
- [x] Extend schema: firmSubscriptions, subscriptionPlans, paymentPlans, swissPayoutAccounts, firmBillingHistory
- [x] Add superadmin role to users table
- [x] Superadmin dashboard: firm list, create firm, approve subdomains, manage subscription plans
- [x] Firm creation flow: name, address, VAT/UID, subdomain request, auto/manual approval
- [x] Subscription plan management: Starter/Pro/Enterprise with user limits, pricing
- [x] Firm subscription UI: current plan, upgrade/downgrade, billing history
- [x] Manual payment option: invoice generation for firm subscription
- [x] Settings panel: Adyen, branding, VAT configuration

## Phase 5: Invoice Payment Plans
- [x] Payment plan creation: lawyers define schedule (e.g., 50% upfront, 50% on completion)
- [x] Payment plan UI: PaymentPlanScheduler component (monthly/custom intervals)
- [x] Payment plan visualization on invoice detail page (PaymentInstallmentTimeline component)
- [ ] Auto-generate scheduled invoices based on plan
- [x] Adyen integration: payment link per invoice
- [x] Payment status tracking: pending, paid, overdue, cancelled

## Phase 6: Final Integration & Polish
- [x] Fix superadmin role check in SuperadminDashboard (use role field instead of email domain)
- [x] Fix duplicate useState/useEffect imports in SuperadminDashboard
- [x] Add setupSuperadmin endpoint for first-time superadmin designation
- [x] Add test for setupSuperadmin endpoint (vitest passing)
- [x] Integrate PaymentInstallmentTimeline into ClientDashboard
- [x] Update paymentPlans.listByInvoice to allow client access
- [x] Fix ClientDashboard to call hooks unconditionally
- [x] Add email delivery status indicator to InvoiceDetail
- [x] Remove email-domain authorization checks from remaining pages (AdminSettings updated)
- [x] Verify all role-based access controls work correctly (role field now used consistently)

## Phase 7: Advanced Time Tracking
- [x] Time tracking schema: timeEntries, timeEntryTags, lawyerRates tables
- [x] Browser-based timer widget with start/pause/reset controls
- [x] Time entry creation and management (create, update, delete)
- [x] Time entry list with duration and calculated amounts
- [x] Time Reports page with monthly breakdown
- [x] Time analytics: total hours, billable hours, utilization rate
- [x] Daily time breakdown with date grouping
- [x] Firm analytics for admins (all lawyers' time data)
- [ ] Add time entries to invoices (simplified integration)
- [ ] Time entry submission workflow (draft → submitted → billed)

## Phase 8: Enhanced Client Portal
- [x] Improved document exchange UI with drag-and-drop upload (DocumentExchange component)
- [x] Document sharing permissions (view-only, download, share dialog)
- [x] Case status timeline visible to clients (CaseStatusTimeline component)
- [x] Client portal dashboard (ClientPortal page with case list and tabs)
- [x] Case update notifications integration
- [x] Client communication (messages tab)
- [x] Download history tracking for clients (via logAccess)
- [x] Navigation updates (My Cases for clients, Time Reports for lawyers)
