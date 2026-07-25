import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCaseAccess } from "../access";
import { getDb, getFirmMemberByUserId, getClientByUserId, createCaseEvent } from "../db";
import { documentRequests } from "../../drizzle/schema";
import { getCaseNotificationRecipients } from "../caseNotifications";
import { sendDocumentRequestEmail, sendCaseUpdateEmail } from "../email";
import { getAppBaseUrl } from "../tenant";

export const documentRequestsRouter = router({
  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCaseAccess(ctx.user.id, input.caseId);
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.caseId, input.caseId))
        .orderBy(desc(documentRequests.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        caseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { caseRow } = await assertCaseAccess(ctx.user.id, input.caseId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(documentRequests).values({
        firmId: caseRow.firmId,
        caseId: input.caseId,
        requestedByUserId: ctx.user.id,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "pending",
      });

      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "shared",
        title: "Document requested",
        content: `Requested: ${input.title}${input.description ? ` — ${input.description}` : ""}`,
      });

      const { caseTitle, recipients } = await getCaseNotificationRecipients(
        input.caseId,
        ctx.user.id
      );
      const caseUrl = `${getAppBaseUrl(ctx.req)}/client-portal`;
      for (const r of recipients.filter((x) => x.kind === "client")) {
        await sendDocumentRequestEmail({
          recipientEmail: r.email,
          recipientName: r.name,
          caseTitle,
          requestTitle: input.title,
          description: input.description,
          caseUrl,
        }).catch((err) => console.error("[Email] document request:", err.message));
      }

      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  fulfill: protectedProcedure
    .input(
      z.object({
        requestId: z.number(),
        documentId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [req] = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.id, input.requestId))
        .limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Request is not pending" });
      }

      await assertCaseAccess(ctx.user.id, req.caseId);

      // Clients fulfill; firm staff may also mark fulfilled
      const client = await getClientByUserId(ctx.user.id);
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!client && !member) throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(documentRequests)
        .set({
          status: "fulfilled",
          fulfilledDocumentId: input.documentId,
          fulfilledAt: new Date(),
        })
        .where(and(eq(documentRequests.id, input.requestId)));

      await createCaseEvent({
        caseId: req.caseId,
        authorUserId: ctx.user.id,
        eventType: "document_upload",
        visibility: "shared",
        title: "Document request fulfilled",
        content: `Uploaded for request: ${req.title}`,
      });

      const { caseTitle, recipients } = await getCaseNotificationRecipients(
        req.caseId,
        ctx.user.id
      );
      const caseUrl = `${getAppBaseUrl(ctx.req)}/cases/${req.caseId}`;
      for (const r of recipients.filter((x) => x.kind === "lawyer")) {
        await sendCaseUpdateEmail({
          recipientEmail: r.email,
          recipientName: r.name,
          caseTitle,
          updateTitle: "Document uploaded",
          updateBody: `The client fulfilled document request “${req.title}”.`,
          caseUrl,
        }).catch((err) => console.error("[Email] fulfill:", err.message));
      }

      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.id, input.requestId))
        .limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCaseAccess(ctx.user.id, req.caseId);
      await db
        .update(documentRequests)
        .set({ status: "cancelled" })
        .where(eq(documentRequests.id, input.requestId));
      return { success: true };
    }),
});
