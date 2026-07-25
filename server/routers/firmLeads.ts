import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  addCaseAssignment,
  createCase,
  createClient,
  getDb,
  getFirmMemberByUserId,
} from "../db";
import { firmLeads } from "../../drizzle/schema";

const leadStage = z.enum([
  "new",
  "contacted",
  "qualified",
  "consultation",
  "proposal",
  "won",
  "lost",
]);

async function requireLawyerOrAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!["admin", "lawyer"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

async function requireStaff(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

export const firmLeadsRouter = router({
  list: protectedProcedure
    .input(z.object({ stage: leadStage.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(firmLeads.firmId, member.firmId)];
      if (input?.stage) conditions.push(eq(firmLeads.stage, input.stage));

      return db
        .select()
        .from(firmLeads)
        .where(and(...conditions))
        .orderBy(desc(firmLeads.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        contactName: z.string().min(1).max(200),
        email: z.string().email().optional().nullable(),
        phone: z.string().max(50).optional().nullable(),
        company: z.string().max(255).optional().nullable(),
        source: z.string().max(100).optional().nullable(),
        stage: leadStage.optional(),
        notes: z.string().optional().nullable(),
        assignedUserId: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(firmLeads).values({
        firmId: member.firmId,
        contactName: input.contactName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        source: input.source ?? null,
        stage: input.stage ?? "new",
        notes: input.notes ?? null,
        assignedUserId: input.assignedUserId ?? null,
        createdByUserId: ctx.user.id,
      });

      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        contactName: z.string().min(1).max(200).optional(),
        email: z.string().email().optional().nullable(),
        phone: z.string().max(50).optional().nullable(),
        company: z.string().max(255).optional().nullable(),
        source: z.string().max(100).optional().nullable(),
        notes: z.string().optional().nullable(),
        assignedUserId: z.number().optional().nullable(),
        stage: leadStage.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db
        .select()
        .from(firmLeads)
        .where(and(eq(firmLeads.id, input.id), eq(firmLeads.firmId, member.firmId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      await db
        .update(firmLeads)
        .set({
          ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.company !== undefined ? { company: data.company } : {}),
          ...(data.source !== undefined ? { source: data.source } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.assignedUserId !== undefined
            ? { assignedUserId: data.assignedUserId }
            : {}),
          ...(data.stage !== undefined ? { stage: data.stage } : {}),
        })
        .where(eq(firmLeads.id, id));

      return { success: true as const };
    }),

  setStage: protectedProcedure
    .input(z.object({ id: z.number(), stage: leadStage }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db
        .select()
        .from(firmLeads)
        .where(and(eq(firmLeads.id, input.id), eq(firmLeads.firmId, member.firmId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(firmLeads)
        .set({ stage: input.stage })
        .where(eq(firmLeads.id, input.id));

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db
        .select()
        .from(firmLeads)
        .where(and(eq(firmLeads.id, input.id), eq(firmLeads.firmId, member.firmId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(firmLeads).where(eq(firmLeads.id, input.id));
      return { success: true as const };
    }),

  convert: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        createCase: z.boolean().optional(),
        caseTitle: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lead] = await db
        .select()
        .from(firmLeads)
        .where(and(eq(firmLeads.id, input.leadId), eq(firmLeads.firmId, member.firmId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      if (lead.convertedClientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lead already converted" });
      }

      const nameParts = lead.contactName.trim().split(/\s+/);
      const firstName = nameParts[0] || lead.contactName;
      const lastName = nameParts.slice(1).join(" ") || undefined;

      const clientResult = await createClient({
        firmId: member.firmId,
        type: lead.company ? "company" : "individual",
        firstName: lead.company ? undefined : firstName,
        lastName: lead.company ? undefined : lastName,
        companyName: lead.company || undefined,
        contactPerson: lead.company ? lead.contactName : undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        notes: lead.notes || undefined,
        status: "invited",
      });
      const clientId = Number((clientResult as { insertId?: number }).insertId ?? 0);
      if (!clientId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create client" });

      let caseId: number | null = null;
      if (input.createCase) {
        const title =
          input.caseTitle ||
          `Matter — ${lead.company || lead.contactName}`;
        const caseResult = await createCase({
          firmId: member.firmId,
          title,
          type: "other",
          status: "open",
          description: lead.notes || undefined,
          createdByUserId: ctx.user.id,
        });
        caseId = Number((caseResult as { insertId?: number }).insertId ?? 0);
        if (caseId) {
          await addCaseAssignment({
            caseId,
            clientId,
            assignmentType: "client",
            assignedByUserId: ctx.user.id,
          });
        }
      }

      await db
        .update(firmLeads)
        .set({
          stage: "won",
          convertedClientId: clientId,
          convertedCaseId: caseId,
        })
        .where(eq(firmLeads.id, lead.id));

      return { clientId, caseId };
    }),
});
