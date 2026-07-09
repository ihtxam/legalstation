import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  caseAssignments,
  caseEvents,
  cases,
  clients,
  documentAuditLog,
  documentFolders,
  documentVersions,
  documents,
  firmMembers,
  firms,
  InsertCase,
  InsertCaseAssignment,
  InsertCaseEvent,
  InsertClient,
  InsertDocument,
  InsertDocumentAuditLog,
  InsertDocumentFolder,
  InsertDocumentVersion,
  InsertFirm,
  InsertFirmMember,
  InsertInvitation,
  InsertInvoice,
  InsertInvoiceItem,
  InsertMessage,
  InsertMessageRead,
  invitations,
  invoiceItems,
  invoices,
  messageReads,
  messages,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ─── Firm helpers ────────────────────────────────────────────────────────────
export async function createFirm(data: InsertFirm) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(firms).values(data);
  return result;
}

export async function getFirmBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(firms).where(eq(firms.slug, slug)).limit(1);
  return result[0];
}

export async function getFirmById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(firms).where(eq(firms.id, id)).limit(1);
  return result[0];
}

export async function updateFirm(id: number, data: Partial<InsertFirm>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(firms).set(data).where(eq(firms.id, id));
}

// ─── Firm member helpers ──────────────────────────────────────────────────────
export async function createFirmMember(data: InsertFirmMember) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(firmMembers).values(data);
}

export async function getFirmMember(firmId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(firmMembers)
    .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.userId, userId), eq(firmMembers.isActive, true)))
    .limit(1);
  return result[0];
}

export async function getFirmMemberByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(firmMembers)
    .where(and(eq(firmMembers.userId, userId), eq(firmMembers.isActive, true)))
    .limit(1);
  return result[0];
}

export async function getFirmMembers(firmId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ member: firmMembers, user: users })
    .from(firmMembers)
    .innerJoin(users, eq(firmMembers.userId, users.id))
    .where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.isActive, true)));
}

// ─── Invitation helpers ───────────────────────────────────────────────────────
export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(invitations).values(data);
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result[0];
}

export async function acceptInvitation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, id));
}

// ─── Client helpers ───────────────────────────────────────────────────────────
export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(clients).values(data);
  return result;
}

export async function getClientsByFirm(firmId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.firmId, firmId)).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number, firmId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients)
    .where(and(eq(clients.id, id), eq(clients.firmId, firmId))).limit(1);
  return result[0];
}

export async function getClientByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
  return result[0];
}

export async function updateClient(id: number, firmId: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.firmId, firmId)));
}

// ─── Case helpers ─────────────────────────────────────────────────────────────
export async function createCase(data: InsertCase) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(cases).values(data);
  return result;
}

export async function getCasesByFirm(firmId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cases).where(eq(cases.firmId, firmId)).orderBy(desc(cases.createdAt));
}

export async function getCaseById(id: number, firmId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases)
    .where(and(eq(cases.id, id), eq(cases.firmId, firmId))).limit(1);
  return result[0];
}

export async function updateCase(id: number, firmId: number, data: Partial<InsertCase>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(cases).set(data).where(and(eq(cases.id, id), eq(cases.firmId, firmId)));
}

export async function getCaseAssignments(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseId));
}

export async function addCaseAssignment(data: InsertCaseAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(caseAssignments).values(data);
}

export async function removeCaseAssignment(caseId: number, userId?: number, clientId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (userId) {
    await db.delete(caseAssignments).where(and(eq(caseAssignments.caseId, caseId), eq(caseAssignments.userId, userId)));
  } else if (clientId) {
    await db.delete(caseAssignments).where(and(eq(caseAssignments.caseId, caseId), eq(caseAssignments.clientId, clientId)));
  }
}

export async function getCasesByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.select().from(caseAssignments)
    .where(and(eq(caseAssignments.clientId, clientId), eq(caseAssignments.assignmentType, "client")));
  if (!assignments.length) return [];
  const caseIds = assignments.map(a => a.caseId);
  return db.select().from(cases).where(inArray(cases.id, caseIds)).orderBy(desc(cases.createdAt));
}

// ─── Case event helpers ───────────────────────────────────────────────────────
export async function createCaseEvent(data: InsertCaseEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(caseEvents).values(data);
  return result;
}

export async function getCaseEvents(caseId: number, includeInternal: boolean) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = includeInternal
    ? eq(caseEvents.caseId, caseId)
    : and(eq(caseEvents.caseId, caseId), eq(caseEvents.visibility, "shared"));
  return db.select({ event: caseEvents, author: users })
    .from(caseEvents)
    .innerJoin(users, eq(caseEvents.authorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(caseEvents.createdAt));
}

export async function updateCaseEvent(id: number, caseId: number, data: Partial<InsertCaseEvent>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(caseEvents).set(data).where(and(eq(caseEvents.id, id), eq(caseEvents.caseId, caseId)));
}

export async function deleteCaseEvent(id: number, caseId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(caseEvents).where(and(eq(caseEvents.id, id), eq(caseEvents.caseId, caseId)));
}

// ─── Document folder helpers ──────────────────────────────────────────────────
export async function createDocumentFolder(data: InsertDocumentFolder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(documentFolders).values(data);
  return result;
}

export async function getDocumentFolders(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentFolders).where(eq(documentFolders.caseId, caseId));
}

// ─── Document helpers ─────────────────────────────────────────────────────────
export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(documents).values(data);
  return result;
}

export async function getDocumentsByCase(caseId: number, includeInternal: boolean) {
  const db = await getDb();
  if (!db) return [];
  const whereClause = includeInternal
    ? and(eq(documents.caseId, caseId), eq(documents.isDeleted, false))
    : and(eq(documents.caseId, caseId), eq(documents.visibility, "shared"), eq(documents.isDeleted, false));
  return db.select({ doc: documents, uploader: users })
    .from(documents)
    .innerJoin(users, eq(documents.uploadedByUserId, users.id))
    .where(whereClause)
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number, firmId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.firmId, firmId), eq(documents.isDeleted, false))).limit(1);
  return result[0];
}

export async function updateDocument(id: number, firmId: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.firmId, firmId)));
}

export async function createDocumentVersion(data: InsertDocumentVersion) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(documentVersions).values(data);
}

export async function getDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version));
}

export async function pruneOldVersions(documentId: number) {
  const db = await getDb();
  if (!db) return;
  const versions = await db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version));
  if (versions.length > 3) {
    const toDelete = versions.slice(3).map(v => v.id);
    await db.delete(documentVersions).where(inArray(documentVersions.id, toDelete));
  }
}

export async function createDocumentAuditEntry(data: InsertDocumentAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(documentAuditLog).values(data);
}

export async function getDocumentAuditLog(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ log: documentAuditLog, user: users })
    .from(documentAuditLog)
    .innerJoin(users, eq(documentAuditLog.userId, users.id))
    .where(eq(documentAuditLog.documentId, documentId))
    .orderBy(desc(documentAuditLog.createdAt));
}

// ─── Message helpers ──────────────────────────────────────────────────────────
export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(messages).values(data);
  return result;
}

export async function getMessagesByCase(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ message: messages, sender: users })
    .from(messages)
    .innerJoin(users, eq(messages.senderUserId, users.id))
    .where(and(eq(messages.caseId, caseId), eq(messages.isDeleted, false)))
    .orderBy(messages.createdAt);
}

export async function markMessageRead(data: InsertMessageRead) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(messageReads)
    .where(and(eq(messageReads.messageId, data.messageId), eq(messageReads.userId, data.userId))).limit(1);
  if (!existing.length) {
    await db.insert(messageReads).values(data);
  }
}

export async function getUnreadMessageCount(userId: number, firmId: number) {
  const db = await getDb();
  if (!db) return 0;
  const allMessages = await db.select({ id: messages.id }).from(messages)
    .where(and(eq(messages.firmId, firmId), eq(messages.isDeleted, false)));
  if (!allMessages.length) return 0;
  const msgIds = allMessages.map(m => m.id);
  const readIds = await db.select({ messageId: messageReads.messageId }).from(messageReads)
    .where(and(eq(messageReads.userId, userId), inArray(messageReads.messageId, msgIds)));
  const readSet = new Set(readIds.map(r => r.messageId));
  return msgIds.filter(id => !readSet.has(id)).length;
}

// ─── Invoice helpers ──────────────────────────────────────────────────────────
export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(invoices).values(data);
  return result;
}

export async function getInvoicesByFirm(firmId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ invoice: invoices, client: clients })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.firmId, firmId))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoicesByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: number, firmId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.firmId, firmId))).limit(1);
  return result[0];
}

export async function updateInvoice(id: number, firmId: number, data: Partial<InsertInvoice>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(invoices).set(data).where(and(eq(invoices.id, id), eq(invoices.firmId, firmId)));
}

export async function createInvoiceItem(data: InsertInvoiceItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(invoiceItems).values(data);
}

export async function getInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.sortOrder);
}

export async function deleteInvoiceItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

export async function getNextInvoiceNumber(firmId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "INV-0001";
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices).where(eq(invoices.firmId, firmId));
  const count = Number(result[0]?.count ?? 0) + 1;
  return `INV-${String(count).padStart(4, "0")}`;
}
