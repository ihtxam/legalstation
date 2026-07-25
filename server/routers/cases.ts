import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  addCaseAssignment,
  createCase,
  createCaseEvent,
  deleteCaseEvent,
  getCaseAssignments,
  getCaseById,
  getCaseEvents,
  getCasesByClientId,
  getCasesByFirm,
  getCasesByAssignedUser,
  getFirmMemberByUserId,
  getClientByUserId,
  removeCaseAssignment,
  updateCase,
  updateCaseEvent,
  getFirmMembers,
  getClientsByFirm,
  getDb,
} from "../db";
import { users } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { assertCaseAccess } from "../access";
import { canSeeFirmWideCases, isFirmAdminLike } from "@shared/roles";
import { getCaseNotificationRecipients } from "../caseNotifications";
import { sendCaseUpdateEmail } from "../email";
import { getAppBaseUrl } from "../tenant";

async function requireFirmMember(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  return member;
}

export const casesRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["open", "pending", "closed", "archived"]).optional(),
      type: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (member) {
        let all = canSeeFirmWideCases(member.firmRole)
          ? await getCasesByFirm(member.firmId)
          : await getCasesByAssignedUser(member.firmId, ctx.user.id);
        if (input?.search) {
          const q = input.search.toLowerCase();
          all = all.filter(c => c.title.toLowerCase().includes(q) || c.referenceNumber?.toLowerCase().includes(q));
        }
        if (input?.status) all = all.filter(c => c.status === input.status);
        if (input?.type) all = all.filter(c => c.type === input.type);
        return all;
      }
      const client = await getClientByUserId(ctx.user.id);
      if (client) {
        return getCasesByClientId(client.id);
      }
      return [];
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { caseRow, includeInternal } = await assertCaseAccess(ctx.user.id, input.id);
      const assignments = includeInternal ? await getCaseAssignments(caseRow.id) : [];
      return { ...caseRow, assignments };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      referenceNumber: z.string().optional(),
      type: z.enum(["civil", "criminal", "corporate", "family", "real_estate", "employment", "tax", "immigration", "intellectual_property", "other"]),
      status: z.enum(["open", "pending", "closed", "archived"]).default("open"),
      description: z.string().optional(),
      courtName: z.string().optional(),
      courtFileNumber: z.string().optional(),
      deadline: z.number().optional(),
      clientIds: z.array(z.number()).optional(),
      lawyerIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!isFirmAdminLike(member.firmRole) && member.firmRole !== "lawyer") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { clientIds, lawyerIds, deadline, ...caseData } = input;
      await createCase({
        ...caseData,
        firmId: member.firmId,
        createdByUserId: ctx.user.id,
        deadline: deadline ? new Date(deadline) : undefined,
      });
      const newCase = (await getCasesByFirm(member.firmId))[0];
      if (newCase) {
        for (const clientId of (clientIds ?? [])) {
          await addCaseAssignment({ caseId: newCase.id, clientId, assignmentType: "client", assignedByUserId: ctx.user.id });
        }
        const lawyerSet = new Set(lawyerIds ?? []);
        // Auto-assign creator so lawyers see cases they open
        if (member.firmRole === "lawyer" || member.firmRole === "subadmin") {
          lawyerSet.add(ctx.user.id);
        }
        for (const userId of Array.from(lawyerSet)) {
          await addCaseAssignment({ caseId: newCase.id, userId, assignmentType: "lawyer", assignedByUserId: ctx.user.id });
        }
        await createCaseEvent({
          caseId: newCase.id,
          authorUserId: ctx.user.id,
          eventType: "system",
          visibility: "internal",
          title: "Case created",
          content: `Case "${newCase.title}" was created.`,
        });
      }
      return newCase;
    }),

  /** Client announces a new litige / dispute from the client portal. */
  createLitige: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(255),
        type: z
          .enum([
            "civil",
            "criminal",
            "corporate",
            "family",
            "real_estate",
            "employment",
            "tax",
            "immigration",
            "intellectual_property",
            "other",
          ])
          .default("other"),
        description: z.string().min(10).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN", message: "Client profile required" });

      const ref = `LIT-${Date.now().toString(36).toUpperCase()}`;
      const insertResult = await createCase({
        firmId: client.firmId,
        title: input.title,
        referenceNumber: ref,
        type: input.type,
        status: "pending",
        description: input.description,
        createdByUserId: ctx.user.id,
      });
      const newCaseId = Number((insertResult as { insertId?: number }).insertId ?? 0);
      const newCase = newCaseId
        ? await getCaseById(newCaseId, client.firmId)
        : (await getCasesByFirm(client.firmId)).find((c) => c.referenceNumber === ref);
      if (!newCase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await addCaseAssignment({
        caseId: newCase.id,
        clientId: client.id,
        assignmentType: "client",
        assignedByUserId: ctx.user.id,
      });

      await createCaseEvent({
        caseId: newCase.id,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "shared",
        title: "Litige announced by client",
        content: input.description,
      });

      // Notify firm admins/lawyers
      const members = await getFirmMembers(client.firmId);
      const db = await getDb();
      const caseUrl = `${getAppBaseUrl(ctx.req)}/cases/${newCase.id}`;
      if (db) {
        for (const m of members.filter((x) => ["admin", "lawyer"].includes(x.member.firmRole))) {
          const [u] = await db.select().from(users).where(eq(users.id, m.member.userId)).limit(1);
          if (!u?.email) continue;
          await sendCaseUpdateEmail({
            recipientEmail: u.email,
            recipientName: u.name || u.email,
            caseTitle: newCase.title,
            updateTitle: "New litige from client",
            updateBody: `${client.firstName || client.companyName || "A client"} submitted: ${input.title}`,
            caseUrl,
          }).catch((err) => console.error("[Email] litige:", err.message));
        }
      }

      return newCase;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      referenceNumber: z.string().optional(),
      type: z.enum(["civil", "criminal", "corporate", "family", "real_estate", "employment", "tax", "immigration", "intellectual_property", "other"]).optional(),
      status: z.enum(["open", "pending", "closed", "archived"]).optional(),
      description: z.string().optional(),
      courtName: z.string().optional(),
      courtFileNumber: z.string().optional(),
      deadline: z.number().optional().nullable(),
      matterStageId: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const { id, deadline, matterStageId, ...data } = input;
      const existing = await getCaseById(id, member.firmId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (data.status && data.status !== existing.status) {
        await createCaseEvent({
          caseId: id,
          authorUserId: ctx.user.id,
          eventType: "status_change",
          visibility: "shared",
          title: "Status changed",
          content: `Status changed from "${existing.status}" to "${data.status}".`,
        });
        const { caseTitle, recipients } = await getCaseNotificationRecipients(id, ctx.user.id);
        const caseUrl = `${getAppBaseUrl(ctx.req)}/client-portal`;
        for (const r of recipients.filter((x) => x.kind === "client")) {
          await sendCaseUpdateEmail({
            recipientEmail: r.email,
            recipientName: r.name,
            caseTitle,
            updateTitle: "Case status updated",
            updateBody: `Status changed from "${existing.status}" to "${data.status}".`,
            caseUrl,
          }).catch((err) => console.error("[Email] status:", err.message));
        }
      }
      await updateCase(id, member.firmId, {
        ...data,
        ...(matterStageId !== undefined ? { matterStageId } : {}),
        deadline: deadline ? new Date(deadline) : deadline === null ? null : undefined,
      });
      return { success: true };
    }),

  getEvents: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { includeInternal } = await assertCaseAccess(ctx.user.id, input.caseId);
      return getCaseEvents(input.caseId, includeInternal);
    }),

  addNote: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      content: z.string().min(1),
      visibility: z.enum(["internal", "shared"]),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.visibility === "internal" && !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "note",
        visibility: input.visibility,
        title: input.title,
        content: input.content,
      });

      if (input.visibility === "shared") {
        const { caseTitle, recipients } = await getCaseNotificationRecipients(
          input.caseId,
          ctx.user.id
        );
        const caseUrl = `${getAppBaseUrl(ctx.req)}/client-portal`;
        for (const r of recipients.filter((x) => x.kind === "client")) {
          await sendCaseUpdateEmail({
            recipientEmail: r.email,
            recipientName: r.name,
            caseTitle,
            updateTitle: input.title || "New update on your case",
            updateBody: input.content,
            caseUrl,
          }).catch((err) => console.error("[Email] note:", err.message));
        }
      }

      return { success: true };
    }),

  updateNote: protectedProcedure
    .input(z.object({
      id: z.number(),
      caseId: z.number(),
      content: z.string().min(1),
      title: z.string().optional(),
      visibility: z.enum(["internal", "shared"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { id, caseId, ...data } = input;
      await updateCaseEvent(id, caseId, data);
      return { success: true };
    }),

  deleteNote: protectedProcedure
    .input(z.object({ id: z.number(), caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteCaseEvent(input.id, input.caseId);
      return { success: true };
    }),

  // Case assignment management
  getAssignmentOptions: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseData = await getCaseById(input.caseId, member.firmId);
      if (!caseData) throw new TRPCError({ code: "NOT_FOUND" });
      
      const lawyers = await getFirmMembers(member.firmId);
      const clients = await getClientsByFirm(member.firmId);
      const assignments = await getCaseAssignments(input.caseId);
      
      const availableLawyers = lawyers.filter(
        (l) => !assignments.some((a) => a.userId === l.member.userId && a.assignmentType === "lawyer")
      );
      const availableClients = clients.filter(
        (c) => !assignments.some((a) => a.clientId === c.id)
      );

      const enrichedAssignments = assignments.map((a) => {
        if (a.assignmentType === "lawyer") {
          const match = lawyers.find((l) => l.member.userId === a.userId);
          return {
            ...a,
            displayName: match?.user.name || match?.user.email || `User #${a.userId}`,
          };
        }
        const match = clients.find((c) => c.id === a.clientId);
        const displayName = match
          ? match.type === "company"
            ? match.companyName || `Client #${a.clientId}`
            : [match.firstName, match.lastName].filter(Boolean).join(" ") || `Client #${a.clientId}`
          : `Client #${a.clientId}`;
        return { ...a, displayName };
      });

      return {
        availableLawyers,
        availableClients,
        currentAssignments: enrichedAssignments,
      };
    }),

  assignLawyer: protectedProcedure
    .input(z.object({ caseId: z.number(), lawyerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseData = await getCaseById(input.caseId, member.firmId);
      if (!caseData) throw new TRPCError({ code: "NOT_FOUND" });
      
      await addCaseAssignment({
        caseId: input.caseId,
        userId: input.lawyerId,
        assignmentType: "lawyer",
        assignedByUserId: ctx.user.id,
      });
      
      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "assignment",
        visibility: "shared",
        title: "Lawyer assigned",
        content: `A lawyer was assigned to this case. You can now message them directly.`,
      });

      // Open case if it was pending (client-announced litige)
      if (caseData.status === "pending") {
        await updateCase(input.caseId, member.firmId, { status: "open" });
      }

      const { caseTitle, recipients } = await getCaseNotificationRecipients(
        input.caseId,
        ctx.user.id
      );
      const caseUrl = `${getAppBaseUrl(ctx.req)}/client-portal`;
      for (const r of recipients.filter((x) => x.kind === "client")) {
        await sendCaseUpdateEmail({
          recipientEmail: r.email,
          recipientName: r.name,
          caseTitle,
          updateTitle: "A lawyer was assigned to your case",
          updateBody:
            "Your legal team assigned a lawyer. You can now exchange messages and documents in the client portal.",
          caseUrl,
        }).catch((err) => console.error("[Email] assign:", err.message));
      }

      // Also notify the assigned lawyer
      const db = await getDb();
      if (db) {
        const [lawyer] = await db
          .select()
          .from(users)
          .where(eq(users.id, input.lawyerId))
          .limit(1);
        if (lawyer?.email) {
          await sendCaseUpdateEmail({
            recipientEmail: lawyer.email,
            recipientName: lawyer.name || lawyer.email,
            caseTitle,
            updateTitle: "You were assigned to a case",
            updateBody: `You have been assigned to “${caseTitle}”.`,
            caseUrl: `${getAppBaseUrl(ctx.req)}/cases/${input.caseId}`,
          }).catch((err) => console.error("[Email] assign lawyer:", err.message));
        }
      }

      return { success: true };
    }),

  assignClient: protectedProcedure
    .input(z.object({ caseId: z.number(), clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseData = await getCaseById(input.caseId, member.firmId);
      if (!caseData) throw new TRPCError({ code: "NOT_FOUND" });
      
      await addCaseAssignment({
        caseId: input.caseId,
        clientId: input.clientId,
        assignmentType: "client",
        assignedByUserId: ctx.user.id,
      });
      
      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "internal",
        title: "Client assigned",
        content: `A client was assigned to this case.`,
      });
      
      return { success: true };
    }),

  removeLawyer: protectedProcedure
    .input(z.object({ caseId: z.number(), lawyerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseData = await getCaseById(input.caseId, member.firmId);
      if (!caseData) throw new TRPCError({ code: "NOT_FOUND" });
      
      await removeCaseAssignment(input.caseId, input.lawyerId);
      
      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "internal",
        title: "Lawyer removed",
        content: `A lawyer was removed from this case.`,
      });
      
      return { success: true };
    }),

  removeClient: protectedProcedure
    .input(z.object({ caseId: z.number(), clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseData = await getCaseById(input.caseId, member.firmId);
      if (!caseData) throw new TRPCError({ code: "NOT_FOUND" });
      
      await removeCaseAssignment(input.caseId, undefined, input.clientId);
      
      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "internal",
        title: "Client removed",
        content: `A client was removed from this case.`,
      });
      
      return { success: true };
    }),
});
