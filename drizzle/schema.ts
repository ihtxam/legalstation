import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users (OAuth + email/password; platform role separate from firm role) ──
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** scrypt hash (salt:hex format); used for email/password SaaS login */
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: boolean("mustChangePassword").notNull().default(false),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  /** Optional TOTP 2FA (base32 secret); enabled via totpEnabled */
  totpSecret: varchar("totpSecret", { length: 128 }),
  totpEnabled: boolean("totpEnabled").notNull().default(false),
  preferredLocale: varchar("preferredLocale", { length: 5 }).default("en"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Firms (tenants) ─────────────────────────────────────────────────────────
export const firms = mysqlTable("firms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  vatNumber: varchar("vatNumber", { length: 50 }),
  logoUrl: text("logoUrl"),
  /** ISO 4217 default billing currency */
  defaultCurrency: varchar("defaultCurrency", { length: 3 }).notNull().default("CHF"),
  /** Default VAT / MWST rate percent (e.g. 8.10) */
  defaultVatRate: decimal("defaultVatRate", { precision: 5, scale: 2 }).notNull().default("8.10"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#001f3f"),
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#c9a227"),
  /** Optional vanity host, e.g. portal.mueller-law.ch */
  customDomain: varchar("customDomain", { length: 255 }),
  subdomainStatus: mysqlEnum("subdomainStatus", ["none", "pending", "active", "rejected"])
    .notNull()
    .default("none"),
  onboardingStep: int("onboardingStep").notNull().default(0),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  credentialsSentAt: timestamp("credentialsSentAt"),
  /** Max document upload size in bytes (firm admin setting; capped by server hard limit). */
  maxUploadBytes: int("maxUploadBytes").notNull().default(10_485_760),
  /** JSON array of allowed file extensions, e.g. ["pdf","jpg","png"]. */
  allowedUploadTypes: text("allowedUploadTypes"),
  /** Standard Swiss IBAN (used for QR-bill when qrIban is empty). */
  iban: varchar("iban", { length: 34 }),
  /** QR-IBAN for Swiss QR-bill (preferred when set; requires QR reference). */
  qrIban: varchar("qrIban", { length: 34 }),
  /** Structured creditor address for Swiss QR-bill (required for valid slips). */
  creditorStreet: varchar("creditorStreet", { length: 70 }),
  creditorBuildingNumber: varchar("creditorBuildingNumber", { length: 16 }),
  creditorPostalCode: varchar("creditorPostalCode", { length: 16 }),
  creditorCity: varchar("creditorCity", { length: 35 }),
  creditorCountry: varchar("creditorCountry", { length: 2 }).default("CH"),
  /**
   * JSON role × capability overrides for this firm.
   * Shape: Partial<Record<capabilityId, Partial<Record<role, access>>>>
   * null / empty = use platform defaults from ROLE_CAPABILITY_MATRIX.
   */
  roleCapabilityOverrides: text("roleCapabilityOverrides"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Firm = typeof firms.$inferSelect;
export type InsertFirm = typeof firms.$inferInsert;

// ─── Firm Members (lawyers, assistants, admins within a firm) ────────────────
export const firmMembers = mysqlTable("firm_members", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  userId: int("userId").notNull(),
  firmRole: mysqlEnum("firmRole", ["admin", "subadmin", "lawyer", "assistant"])
    .notNull()
    .default("lawyer"),
  title: varchar("title", { length: 100 }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirmMember = typeof firmMembers.$inferSelect;
export type InsertFirmMember = typeof firmMembers.$inferInsert;

// ─── Invitations ─────────────────────────────────────────────────────────────
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["subadmin", "lawyer", "assistant", "client"]).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  invitedByUserId: int("invitedByUserId").notNull(),
  clientId: int("clientId"),
  /** Locale used for the invite email and preferred join-page language */
  emailLanguage: varchar("emailLanguage", { length: 5 }).notNull().default("en"),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ─── Clients ─────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  userId: int("userId"),
  type: mysqlEnum("type", ["individual", "company"]).notNull().default("individual"),
  // Individual fields
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),
  // Company fields
  companyName: varchar("companyName", { length: 255 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  contactPerson: varchar("contactPerson", { length: 200 }),
  // Shared
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }).default("Switzerland"),
  notes: text("notes"),
  status: mysqlEnum("status", ["invited", "active", "inactive"]).notNull().default("invited"),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Cases ───────────────────────────────────────────────────────────────────
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  type: mysqlEnum("type", ["civil", "criminal", "corporate", "family", "real_estate", "employment", "tax", "immigration", "intellectual_property", "other"]).notNull().default("civil"),
  status: mysqlEnum("status", ["open", "pending", "closed", "archived"]).notNull().default("open"),
  /** Internal matter pipeline stage (firm-defined) */
  matterStageId: int("matterStageId"),
  description: text("description"),
  courtName: varchar("courtName", { length: 255 }),
  courtFileNumber: varchar("courtFileNumber", { length: 100 }),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  deadline: timestamp("deadline"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

// ─── Case Assignments ─────────────────────────────────────────────────────────
export const caseAssignments = mysqlTable("case_assignments", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  userId: int("userId"),
  clientId: int("clientId"),
  assignmentType: mysqlEnum("assignmentType", ["lawyer", "assistant", "client"]).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedByUserId: int("assignedByUserId").notNull(),
});

export type CaseAssignment = typeof caseAssignments.$inferSelect;
export type InsertCaseAssignment = typeof caseAssignments.$inferInsert;

// ─── Case Events (timeline) ───────────────────────────────────────────────────
export const caseEvents = mysqlTable("case_events", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  authorUserId: int("authorUserId").notNull(),
  eventType: mysqlEnum("eventType", ["note", "status_change", "document_upload", "message", "assignment", "deadline", "system"]).notNull(),
  visibility: mysqlEnum("visibility", ["internal", "shared"]).notNull().default("internal"),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CaseEvent = typeof caseEvents.$inferSelect;
export type InsertCaseEvent = typeof caseEvents.$inferInsert;

// ─── Document Requests (lawyer asks client to upload a document) ─────────────
export const documentRequests = mysqlTable("document_requests", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  caseId: int("caseId").notNull(),
  requestedByUserId: int("requestedByUserId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "fulfilled", "cancelled"]).notNull().default("pending"),
  dueDate: timestamp("dueDate"),
  fulfilledDocumentId: int("fulfilledDocumentId"),
  fulfilledAt: timestamp("fulfilledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentRequest = typeof documentRequests.$inferSelect;
export type InsertDocumentRequest = typeof documentRequests.$inferInsert;

// ─── Platform Leads (homepage firm signup / demo requests) ───────────────────
export const platformLeads = mysqlTable("platform_leads", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["demo", "signup"]).notNull(),
  firmName: varchar("firmName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message"),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "closed"]).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformLead = typeof platformLeads.$inferSelect;
export type InsertPlatformLead = typeof platformLeads.$inferInsert;

// ─── Document Folders ─────────────────────────────────────────────────────────
export const documentFolders = mysqlTable("document_folders", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  firmId: int("firmId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type InsertDocumentFolder = typeof documentFolders.$inferInsert;

// ─── Documents ────────────────────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  caseId: int("caseId").notNull(),
  folderId: int("folderId"),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  size: int("size").notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  /** Short note about the uploaded file */
  description: text("description"),
  visibility: mysqlEnum("visibility", ["internal", "shared"]).notNull().default("internal"),
  currentVersion: int("currentVersion").notNull().default(1),
  isDeleted: boolean("isDeleted").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Document Versions ────────────────────────────────────────────────────────
export const documentVersions = mysqlTable("document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  version: int("version").notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  size: int("size").notNull(),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

// ─── Document Audit Log ───────────────────────────────────────────────────────
export const documentAuditLog = mysqlTable("document_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  action: mysqlEnum("action", ["view", "download", "upload", "delete", "version_upload"]).notNull(),
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentAuditLog = typeof documentAuditLog.$inferSelect;
export type InsertDocumentAuditLog = typeof documentAuditLog.$inferInsert;

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  firmId: int("firmId").notNull(),
  senderUserId: int("senderUserId").notNull(),
  content: text("content").notNull(),
  parentMessageId: int("parentMessageId"),
  isDeleted: boolean("isDeleted").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Message Reads ────────────────────────────────────────────────────────────
export const messageReads = mysqlTable("message_reads", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  readAt: timestamp("readAt").defaultNow().notNull(),
});

export type MessageRead = typeof messageReads.$inferSelect;
export type InsertMessageRead = typeof messageReads.$inferInsert;

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  caseId: int("caseId"),
  clientId: int("clientId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"]).notNull().default("draft"),
  issueDate: timestamp("issueDate").defaultNow().notNull(),
  dueDate: timestamp("dueDate").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0.00"),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).notNull().default("7.70"),
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
  notes: text("notes"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripePaymentUrl: text("stripePaymentUrl"),
  adyenPaymentLinkId: varchar("adyenPaymentLinkId", { length: 255 }),
  adyenPaymentLinkUrl: text("adyenPaymentLinkUrl"),
  paidAt: timestamp("paidAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Invoice Items ────────────────────────────────────────────────────────────
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  billingType: mysqlEnum("billingType", ["hourly", "flat_fee"]).notNull().default("flat_fee"),
  quantity: decimal("quantity", { precision: 8, scale: 2 }).notNull().default("1.00"),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;


// ─── Subscription Plans (global, managed by superadmin) ──────────────────────────
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // "Starter", "Pro", "Enterprise"
  description: text("description"),
  maxUsers: int("maxUsers").notNull(),
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearlyPrice", { precision: 10, scale: 2 }).notNull(),
  features: text("features"), // JSON array of feature strings
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ─── Firm Subscriptions ───────────────────────────────────────────────────────────
export const firmSubscriptions = mysqlTable("firm_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  planId: int("planId").notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).notNull().default("monthly"),
  status: mysqlEnum("status", ["trialing", "active", "past_due", "cancelled", "suspended"])
    .notNull()
    .default("active"),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  /** When set, firm is in (or was in) a trial window ending at this time */
  trialEndsAt: timestamp("trialEndsAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirmSubscription = typeof firmSubscriptions.$inferSelect;
export type InsertFirmSubscription = typeof firmSubscriptions.$inferInsert;

// ─── Payment Plans (invoice payment schedules) ────────────────────────────────────
export const paymentPlans = mysqlTable("payment_plans", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // "Monthly 3x", "Upfront + Milestone"
  description: text("description"),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  installmentCount: int("installmentCount").notNull(),
  intervalDays: int("intervalDays").notNull(), // 30 for monthly, 0 for one-time
  /** When true, due installments auto-create child invoices */
  autoGenerateInvoices: boolean("autoGenerateInvoices").notNull().default(true),
  /** When true, generated installment invoices are emailed to the client */
  autoSendInvoices: boolean("autoSendInvoices").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = typeof paymentPlans.$inferInsert;

// ─── Payment Plan Installments ────────────────────────────────────────────────────
export const paymentInstallments = mysqlTable("payment_installments", {
  id: int("id").autoincrement().primaryKey(),
  paymentPlanId: int("paymentPlanId").notNull(),
  installmentNumber: int("installmentNumber").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "overdue", "failed"]).notNull().default("pending"),
  paidAt: timestamp("paidAt"),
  adyenPaymentId: varchar("adyenPaymentId", { length: 255 }),
  /** Child invoice created for this installment (when auto-generate is on) */
  generatedInvoiceId: int("generatedInvoiceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentInstallment = typeof paymentInstallments.$inferSelect;
export type InsertPaymentInstallment = typeof paymentInstallments.$inferInsert;

// ─── Adyen Accounts (per firm) ────────────────────────────────────────────────────
export const adyenAccounts = mysqlTable("adyen_accounts", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  merchantAccount: varchar("merchantAccount", { length: 255 }).notNull(),
  apiKey: text("apiKey").notNull(), // Encrypted
  clientKey: text("clientKey").notNull(), // Public key for frontend
  isActive: boolean("isActive").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdyenAccount = typeof adyenAccounts.$inferSelect;
export type InsertAdyenAccount = typeof adyenAccounts.$inferInsert;

// ─── Agency Settings (global, managed by superadmin) ──────────────────────────────
export const agencySettings = mysqlTable("agency_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(), // "logo_url", "vat_rates", "agency_name"
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgencySetting = typeof agencySettings.$inferSelect;
export type InsertAgencySetting = typeof agencySettings.$inferInsert;

// ─── Superadmin Audit Log ────────────────────────────────────────────────────────
export const superadminAuditLog = mysqlTable("superadmin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  superadminId: int("superadminId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // "create_firm", "update_plan", "suspend_firm"
  targetType: varchar("targetType", { length: 50 }).notNull(), // "firm", "plan", "subscription"
  targetId: int("targetId"),
  details: text("details"), // JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SuperadminAuditLog = typeof superadminAuditLog.$inferSelect;
export type InsertSuperadminAuditLog = typeof superadminAuditLog.$inferInsert;

// ─── Active Timers (server-persisted running stopwatch per lawyer) ───────────
export const activeTimers = mysqlTable("active_timers", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  lawyerId: int("lawyerId").notNull(),
  caseId: int("caseId").notNull(),
  description: text("description").notNull().default(""),
  startedAt: timestamp("startedAt").notNull(),
  /** Accumulated seconds from previous pause segments */
  accumulatedSeconds: int("accumulatedSeconds").notNull().default(0),
  isPaused: boolean("isPaused").notNull().default(false),
  pausedAt: timestamp("pausedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActiveTimer = typeof activeTimers.$inferSelect;
export type InsertActiveTimer = typeof activeTimers.$inferInsert;

// ─── Time Tracking (timers, time entries for billable work) ──────────────────
export const timeEntries = mysqlTable("time_entries", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  caseId: int("caseId").notNull(),
  lawyerId: int("lawyerId").notNull(), // firmMember.userId
  description: text("description").notNull(),
  durationMinutes: int("durationMinutes").notNull(), // Total time in minutes
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }), // Optional: override default rate
  billable: boolean("billable").default(true).notNull(),
  invoiceItemId: int("invoiceItemId"), // Link to invoice line item if billed
  status: mysqlEnum("status", ["draft", "submitted", "billed"]).default("draft").notNull(),
  date: timestamp("date").notNull(), // Date when work was performed
  startTime: timestamp("startTime"), // Optional: when timer started
  endTime: timestamp("endTime"), // Optional: when timer ended
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

// ─── Time Entry Tags (categorize time entries: research, drafting, meeting, etc) ──
export const timeEntryTags = mysqlTable("time_entry_tags", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  name: varchar("name", { length: 100 }).notNull(), // "Research", "Drafting", "Meeting", etc
  color: varchar("color", { length: 7 }).default("#3B82F6"), // Hex color
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimeEntryTag = typeof timeEntryTags.$inferSelect;
export type InsertTimeEntryTag = typeof timeEntryTags.$inferInsert;

// ─── Time Entry Tag Mapping (many-to-many) ──────────────────────────────────
export const timeEntryTagMappings = mysqlTable("time_entry_tag_mappings", {
  id: int("id").autoincrement().primaryKey(),
  timeEntryId: int("timeEntryId").notNull(),
  tagId: int("tagId").notNull(),
});

export type TimeEntryTagMapping = typeof timeEntryTagMappings.$inferSelect;
export type InsertTimeEntryTagMapping = typeof timeEntryTagMappings.$inferInsert;

// ─── Lawyer Hourly Rates (default billing rate per lawyer) ───────────────────
export const lawyerRates = mysqlTable("lawyer_rates", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  lawyerId: int("lawyerId").notNull(), // firmMember.userId
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  effectiveTo: timestamp("effectiveTo"), // NULL = current rate
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LawyerRate = typeof lawyerRates.$inferSelect;
export type InsertLawyerRate = typeof lawyerRates.$inferInsert;

// ─── Document Summaries (AI-powered analysis of uploaded documents) ───────────
export const documentSummaries = mysqlTable("document_summaries", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  summary: text("summary"), // Main summary of document content
  keyPoints: text("keyPoints"), // JSON array of key points
  sentiment: varchar("sentiment", { length: 50 }), // positive, neutral, negative
  documentType: varchar("documentType", { length: 100 }), // contract, agreement, letter, etc
  wordCount: int("wordCount"),
  readingTime: int("readingTime"), // Estimated reading time in minutes
  extractedEntities: text("extractedEntities"), // JSON array of named entities (names, dates, amounts)
  status: mysqlEnum("status", ["pending", "analyzing", "completed", "failed"]).default("pending").notNull(),
  error: text("error"), // Error message if analysis failed
  analyzedAt: timestamp("analyzedAt"), // When analysis was completed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentSummary = typeof documentSummaries.$inferSelect;
export type InsertDocumentSummary = typeof documentSummaries.$inferInsert;

// ─── Matter stages (internal case pipeline per firm) ─────────────────────────
export const matterStages = mysqlTable("matter_stages", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  color: varchar("color", { length: 7 }).default("#001f3f"),
  isClosedStage: boolean("isClosedStage").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MatterStage = typeof matterStages.$inferSelect;
export type InsertMatterStage = typeof matterStages.$inferInsert;

// ─── Case tasks / subtasks (matter work breakdown) ───────────────────────────
export const caseTasks = mysqlTable("case_tasks", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  caseId: int("caseId").notNull(),
  parentTaskId: int("parentTaskId"),
  matterStageId: int("matterStageId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["todo", "in_progress", "done", "cancelled"]).notNull().default("todo"),
  assigneeUserId: int("assigneeUserId"),
  dueAt: timestamp("dueAt"),
  /** Mentions as JSON array of user ids, e.g. [1,2] — also parsed from @[userId] in description */
  mentionedUserIds: text("mentionedUserIds"),
  sortOrder: int("sortOrder").notNull().default(0),
  createdByUserId: int("createdByUserId").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CaseTask = typeof caseTasks.$inferSelect;
export type InsertCaseTask = typeof caseTasks.$inferInsert;

// ─── Client activities (meeting notes, todos, next actions, reminders) ───────
export const clientActivities = mysqlTable("client_activities", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  clientId: int("clientId").notNull(),
  type: mysqlEnum("type", ["note", "meeting", "todo", "next_action", "reminder"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  dueAt: timestamp("dueAt"),
  remindAt: timestamp("remindAt"),
  assigneeUserId: int("assigneeUserId"),
  mentionedUserIds: text("mentionedUserIds"),
  completedAt: timestamp("completedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientActivity = typeof clientActivities.$inferSelect;
export type InsertClientActivity = typeof clientActivities.$inferInsert;

// ─── Firm leads (CRM pipeline — Grow-lite) ───────────────────────────────────
export const firmLeads = mysqlTable("firm_leads", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  contactName: varchar("contactName", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  source: varchar("source", { length: 100 }),
  stage: mysqlEnum("stage", [
    "new",
    "contacted",
    "qualified",
    "consultation",
    "proposal",
    "won",
    "lost",
  ])
    .notNull()
    .default("new"),
  notes: text("notes"),
  assignedUserId: int("assignedUserId"),
  convertedClientId: int("convertedClientId"),
  convertedCaseId: int("convertedCaseId"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirmLead = typeof firmLeads.$inferSelect;
export type InsertFirmLead = typeof firmLeads.$inferInsert;

// ─── Firm CMS pages (simple page builder / homepage) ─────────────────────────
export const firmPages = mysqlTable("firm_pages", {
  id: int("id").autoincrement().primaryKey(),
  firmId: int("firmId").notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  /** HTML or markdown body */
  content: text("content"),
  isHome: boolean("isHome").notNull().default(false),
  published: boolean("published").notNull().default(false),
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: varchar("seoDescription", { length: 500 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FirmPage = typeof firmPages.$inferSelect;
export type InsertFirmPage = typeof firmPages.$inferInsert;

// ─── Per-user external calendar connections (Google / Outlook / iCloud) ──────
export const calendarConnections = mysqlTable("calendar_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  firmId: int("firmId"),
  provider: mysqlEnum("provider", ["google", "microsoft", "icloud"]).notNull(),
  accountEmail: varchar("accountEmail", { length: 320 }),
  /** AES-GCM encrypted access token (OAuth) or empty for CalDAV */
  accessTokenEnc: text("accessTokenEnc"),
  /** AES-GCM encrypted refresh token (OAuth) or iCloud app-specific password */
  refreshTokenEnc: text("refreshTokenEnc"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  /** Selected calendar id (Google/Graph) or CalDAV calendar href */
  externalCalendarId: varchar("externalCalendarId", { length: 512 }),
  externalCalendarName: varchar("externalCalendarName", { length: 255 }),
  /** CalDAV principal / calendar home (iCloud) */
  caldavUrl: varchar("caldavUrl", { length: 512 }),
  caldavUsername: varchar("caldavUsername", { length: 320 }),
  syncEnabled: boolean("syncEnabled").notNull().default(true),
  /** both = two-way; push = LexFlow→external; pull = external→LexFlow */
  syncDirection: mysqlEnum("syncDirection", ["both", "push", "pull"]).notNull().default("both"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type InsertCalendarConnection = typeof calendarConnections.$inferInsert;

/** LexFlow-native personal agenda items (sync out to connected calendars). */
export const calendarPersonalEvents = mysqlTable("calendar_personal_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  firmId: int("firmId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  allDay: boolean("allDay").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarPersonalEvent = typeof calendarPersonalEvents.$inferSelect;
export type InsertCalendarPersonalEvent = typeof calendarPersonalEvents.$inferInsert;

/** Events pulled from external calendars (shown in LexFlow agenda). */
export const calendarImportedEvents = mysqlTable("calendar_imported_events", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  userId: int("userId").notNull(),
  externalEventId: varchar("externalEventId", { length: 512 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  allDay: boolean("allDay").notNull().default(false),
  etag: varchar("etag", { length: 255 }),
  rawUpdatedAt: timestamp("rawUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarImportedEvent = typeof calendarImportedEvents.$inferSelect;
export type InsertCalendarImportedEvent = typeof calendarImportedEvents.$inferInsert;

/** Maps LexFlow agenda entities ↔ external calendar event ids (dedupe / two-way). */
export const calendarEventLinks = mysqlTable("calendar_event_links", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  /** case_deadline | case_task | client_activity | personal | imported */
  entityType: varchar("entityType", { length: 32 }).notNull(),
  entityId: int("entityId").notNull(),
  externalEventId: varchar("externalEventId", { length: 512 }).notNull(),
  etag: varchar("etag", { length: 255 }),
  lastPushedAt: timestamp("lastPushedAt"),
  lastPulledAt: timestamp("lastPulledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEventLink = typeof calendarEventLinks.$inferSelect;
export type InsertCalendarEventLink = typeof calendarEventLinks.$inferInsert;
