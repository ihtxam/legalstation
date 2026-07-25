import { TRPCError } from "@trpc/server";
import {
  canCreateInvoice,
  canSeeFirmWideCases,
  canSeeFirmWideInvoices,
  isFirmAdminLike,
  roleHasAccess,
  type RoleCapabilityRow,
} from "@shared/roles";
import {
  getAssignedCaseIdsForUser,
  getCaseAssignments,
  getCaseById,
  getClientByUserId,
  getDocumentById,
  getFirmMemberByUserId,
  getInvoiceById,
  getInvoiceByIdOnly,
} from "./db";
import { getFirmCapabilityMatrix } from "./firmPermissions";

export type FirmContext =
  | { kind: "member"; firmId: number; member: NonNullable<Awaited<ReturnType<typeof getFirmMemberByUserId>>> }
  | { kind: "client"; firmId: number; client: NonNullable<Awaited<ReturnType<typeof getClientByUserId>>> };

export async function resolveFirmContext(userId: number): Promise<FirmContext | null> {
  const member = await getFirmMemberByUserId(userId);
  if (member) return { kind: "member", firmId: member.firmId, member };
  const client = await getClientByUserId(userId);
  if (client) return { kind: "client", firmId: client.firmId, client };
  return null;
}

export async function requireFirmContext(userId: number): Promise<FirmContext> {
  const ctx = await resolveFirmContext(userId);
  if (!ctx) throw new TRPCError({ code: "UNAUTHORIZED" });
  return ctx;
}

async function memberMatrix(firmId: number): Promise<RoleCapabilityRow[]> {
  const { matrix } = await getFirmCapabilityMatrix(firmId);
  return matrix;
}

export async function assertCaseAccess(userId: number, caseId: number) {
  const ctx = await requireFirmContext(userId);
  const caseRow = await getCaseById(caseId, ctx.firmId);
  if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });

  if (ctx.kind === "member") {
    const matrix = await memberMatrix(ctx.firmId);
    if (canSeeFirmWideCases(ctx.member.firmRole, matrix)) {
      return { ctx, caseRow, includeInternal: true as const };
    }
    if (!roleHasAccess(matrix, ctx.member.firmRole, "assignedCases", "view")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to access cases" });
    }
    const assignedIds = await getAssignedCaseIdsForUser(userId);
    if (!assignedIds.includes(caseId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not assigned to this case" });
    }
    return { ctx, caseRow, includeInternal: true as const };
  }

  const assignments = await getCaseAssignments(caseId);
  const assigned = assignments.some(
    (a) => a.assignmentType === "client" && a.clientId === ctx.client.id
  );
  if (!assigned) throw new TRPCError({ code: "FORBIDDEN", message: "Not assigned to this case" });
  return { ctx, caseRow, includeInternal: false as const };
}

export async function assertDocumentAccess(userId: number, documentId: number) {
  const ctx = await requireFirmContext(userId);
  const doc = await getDocumentById(documentId, ctx.firmId);
  if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

  if (ctx.kind === "member") {
    await assertCaseAccess(userId, doc.caseId);
    return { ctx, doc, includeInternal: true as const };
  }

  if (doc.visibility !== "shared") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Document is internal" });
  }
  await assertCaseAccess(userId, doc.caseId);
  return { ctx, doc, includeInternal: false as const };
}

export async function assertInvoiceAccess(userId: number, invoiceId: number) {
  const ctx = await requireFirmContext(userId);
  if (ctx.kind === "member") {
    const invoice = await getInvoiceById(invoiceId, ctx.firmId);
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

    const matrix = await memberMatrix(ctx.firmId);
    if (canSeeFirmWideInvoices(ctx.member.firmRole, matrix)) {
      return { ctx, invoice };
    }

    if (!roleHasAccess(matrix, ctx.member.firmRole, "caseInvoices", "view")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Invoice not available" });
    }

    // Own / assigned invoices
    if (invoice.createdByUserId === userId) {
      return { ctx, invoice };
    }
    if (invoice.caseId != null) {
      const assignedIds = await getAssignedCaseIdsForUser(userId);
      if (assignedIds.includes(invoice.caseId)) {
        return { ctx, invoice };
      }
    }
    throw new TRPCError({ code: "FORBIDDEN", message: "Invoice not available" });
  }

  const invoice = await getInvoiceByIdOnly(invoiceId);
  if (!invoice || invoice.firmId !== ctx.firmId || invoice.clientId !== ctx.client.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
  }
  if (invoice.status === "draft") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invoice not available" });
  }
  return { ctx, invoice };
}

export { isFirmAdminLike, canCreateInvoice };
