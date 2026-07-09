import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
  getFirmMemberByUserId,
  getClientByUserId,
  removeCaseAssignment,
  updateCase,
  updateCaseEvent,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
      // Check if user is a firm member or a client
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (member) {
        let all = await getCasesByFirm(member.firmId);
        if (input?.search) {
          const q = input.search.toLowerCase();
          all = all.filter(c => c.title.toLowerCase().includes(q) || c.referenceNumber?.toLowerCase().includes(q));
        }
        if (input?.status) all = all.filter(c => c.status === input.status);
        if (input?.type) all = all.filter(c => c.type === input.type);
        return all;
      }
      // Client: only their assigned cases
      const client = await getClientByUserId(ctx.user.id);
      if (client) {
        return getCasesByClientId(client.id);
      }
      return [];
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      const c = await getCaseById(input.id, member.firmId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const assignments = await getCaseAssignments(c.id);
      return { ...c, assignments };
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
      if (!["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
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
        for (const userId of (lawyerIds ?? [])) {
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
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const { id, deadline, ...data } = input;
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
      }
      await updateCase(id, member.firmId, {
        ...data,
        deadline: deadline ? new Date(deadline) : deadline === null ? null : undefined,
      });
      return { success: true };
    }),

  // Timeline events
  getEvents: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      const isLawyerOrAdmin = member && ["admin", "lawyer", "assistant"].includes(member.firmRole);
      return getCaseEvents(input.caseId, isLawyerOrAdmin ?? false);
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

  // Assignments
  addAssignment: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      userId: z.number().optional(),
      clientId: z.number().optional(),
      assignmentType: z.enum(["lawyer", "assistant", "client"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      await addCaseAssignment({ ...input, assignedByUserId: ctx.user.id });
      return { success: true };
    }),

  removeAssignment: protectedProcedure
    .input(z.object({ caseId: z.number(), userId: z.number().optional(), clientId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      await removeCaseAssignment(input.caseId, input.userId, input.clientId);
      return { success: true };
    }),
});
