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
  getFirmMemberByUserId,
  updateDocument,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { sendDocumentUploadNotificationEmail } from "../email";
import { getCaseNotificationRecipients } from "../caseNotifications";
import { assertCaseAccess, assertDocumentAccess } from "../access";

export const documentsRouter = router({
  getFolders: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCaseAccess(ctx.user.id, input.caseId);
      return getDocumentFolders(input.caseId);
    }),

  createFolder: protectedProcedure
    .input(z.object({ caseId: z.number(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const { ctx: firmCtx } = await assertCaseAccess(ctx.user.id, input.caseId);
      if (firmCtx.kind !== "member") throw new TRPCError({ code: "FORBIDDEN" });
      await createDocumentFolder({ caseId: input.caseId, firmId: firmCtx.firmId, name: input.name });
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { includeInternal } = await assertCaseAccess(ctx.user.id, input.caseId);
      return getDocumentsByCase(input.caseId, includeInternal);
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
      const { ctx: firmCtx, caseRow } = await assertCaseAccess(ctx.user.id, input.caseId);

      // Clients may only upload shared documents on their assigned cases
      const visibility = firmCtx.kind === "client" ? "shared" : input.visibility;

      await createDocument({
        caseId: input.caseId,
        folderId: input.folderId,
        name: input.name,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        visibility,
        firmId: firmCtx.firmId,
        uploadedByUserId: ctx.user.id,
        currentVersion: 1,
      });
      const docs = await getDocumentsByCase(input.caseId, true);
      const doc = docs[0]?.doc;
      if (doc) {
        await createDocumentVersion({
          documentId: doc.id,
          version: 1,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          size: input.size,
          uploadedByUserId: ctx.user.id,
        });
        await createDocumentAuditEntry({ documentId: doc.id, userId: ctx.user.id, action: "upload" });

        const { caseTitle, recipients } = await getCaseNotificationRecipients(
          input.caseId,
          ctx.user.id
        );
        const origin = String(ctx.req.headers.origin || "");
        const caseUrl = `${origin}/cases/${input.caseId}`;
        const uploaderName = ctx.user.name || "A team member";
        await Promise.allSettled(
          recipients.map((r) =>
            sendDocumentUploadNotificationEmail(
              r.email,
              uploaderName,
              caseTitle || caseRow?.title || `Case ${input.caseId}`,
              input.name,
              caseUrl
            )
          )
        );
      }
      return { success: true, documentId: doc?.id || null };
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
      await assertDocumentAccess(ctx.user.id, input.documentId);
      await createDocumentAuditEntry({ documentId: input.documentId, userId: ctx.user.id, action: input.action });
      return { success: true };
    }),

  /** Return a downloadable URL after access check + audit. */
  getDownloadUrl: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { doc } = await assertDocumentAccess(ctx.user.id, input.documentId);
      await createDocumentAuditEntry({ documentId: doc.id, userId: ctx.user.id, action: "download" });
      return { url: doc.fileUrl, name: doc.name, mimeType: doc.mimeType };
    }),

  getAuditLog: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const doc = await getDocumentById(input.documentId, member.firmId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return getDocumentAuditLog(input.documentId);
    }),

  getVersions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertDocumentAccess(ctx.user.id, input.documentId);
      return getDocumentVersions(input.documentId);
    }),
});
