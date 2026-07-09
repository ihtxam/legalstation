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

// ─── Users (Manus OAuth, extended with firm role) ───────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
  firmRole: mysqlEnum("firmRole", ["admin", "lawyer", "assistant"]).notNull().default("lawyer"),
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
  role: mysqlEnum("role", ["lawyer", "assistant", "client"]).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  invitedByUserId: int("invitedByUserId").notNull(),
  clientId: int("clientId"),
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

