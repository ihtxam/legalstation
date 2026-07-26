import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDocument,
  createDocumentAuditEntry,
  createDocumentFolder,
  createDocumentVersion,
  getDocumentAuditLog,
  getDocumentById,
  getDocumentFolders,
  getDocumentsByCase,
  getDocumentVersions,
  getFirmDocumentAuditLog,
  getFirmMemberByUserId,
  getClientByUserId,
  pruneOldVersions,
  updateDocument,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const documentsRouter = router({
  getFolders: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getDocumentFolders(input.caseId);
    }),

  createFolder: protectedProcedure
    .input(z.object({ caseId: z.number(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      await createDocumentFolder({ caseId: input.caseId, firmId: member.firmId, name: input.name });
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      const isInternal = member && ["admin", "lawyer", "assistant"].includes(member.firmRole);
      return getDocumentsByCase(input.caseId, isInternal ?? false);
    }),

  // Upload document (file already uploaded to S3 via multipart, we register it here)
  register: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      folderId: z.number().optional(),
      name: z.string().min(1).max(255),
      originalName: z.string(),
      mimeType: z.string(),
      size: z.number(),
      fileKey: z.string(),
      fileUrl: z.string(),
      visibility: z.enum(["internal", "shared"]).default("internal"),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      const client = member ? null : await getClientByUserId(ctx.user.id);
      if (!member && !client) throw new TRPCError({ code: "UNAUTHORIZED" });

      const firmId = member?.firmId ?? client!.firmId;
      const visibility = member ? input.visibility : "shared";

      const result = await createDocument({
        ...input,
        visibility,
        firmId,
        uploadedByUserId: ctx.user.id,
        currentVersion: 1,
      });
      const documentId = Number((result as { insertId?: number }).insertId);

      if (documentId) {
        await createDocumentVersion({
          documentId,
          version: 1,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          size: input.size,
          uploadedByUserId: ctx.user.id,
        });
        await createDocumentAuditEntry({ documentId, userId: ctx.user.id, action: "upload" });
      }

      return { success: true, documentId: documentId || null, fileUrl: input.fileUrl, mimeType: input.mimeType, name: input.name };
    }),

  uploadVersion: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      fileKey: z.string(),
      fileUrl: z.string(),
      size: z.number(),
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const doc = await getDocumentById(input.documentId, member.firmId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      const nextVersion = (doc.currentVersion || 1) + 1;
      await createDocumentVersion({
        documentId: doc.id,
        version: nextVersion,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        size: input.size,
        uploadedByUserId: ctx.user.id,
      });
      await updateDocument(doc.id, member.firmId, {
        currentVersion: nextVersion,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        size: input.size,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      });
      await createDocumentAuditEntry({
        documentId: doc.id,
        userId: ctx.user.id,
        action: "version_upload",
      });
      await pruneOldVersions(doc.id);
      return { success: true, version: nextVersion };
    }),

  updateVisibility: protectedProcedure
    .input(z.object({ id: z.number(), visibility: z.enum(["internal", "shared"]) }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateDocument(input.id, member.firmId, { visibility: input.visibility });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      await updateDocument(input.id, member.firmId, { isDeleted: true });
      await createDocumentAuditEntry({ documentId: input.id, userId: ctx.user.id, action: "delete" });
      return { success: true };
    }),

  logAccess: protectedProcedure
    .input(z.object({ documentId: z.number(), action: z.enum(["view", "download"]) }))
    .mutation(async ({ ctx, input }) => {
      await createDocumentAuditEntry({ documentId: input.documentId, userId: ctx.user.id, action: input.action });
      return { success: true };
    }),

  getAuditLog: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      return getDocumentAuditLog(input.documentId);
    }),

  firmAuditLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || member.firmRole !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return getFirmDocumentAuditLog(member.firmId, input?.limit ?? 100);
    }),

  getVersions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getDocumentVersions(input.documentId);
    }),
});
