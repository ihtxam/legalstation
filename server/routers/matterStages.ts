import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getFirmMemberByUserId } from "../db";
import { cases, matterStages } from "../../drizzle/schema";

const DEFAULT_STAGES = [
  { name: "Intake", sortOrder: 0, isClosedStage: false },
  { name: "Active", sortOrder: 1, isClosedStage: false },
  { name: "Discovery", sortOrder: 2, isClosedStage: false },
  { name: "Negotiation", sortOrder: 3, isClosedStage: false },
  { name: "Hearing", sortOrder: 4, isClosedStage: false },
  { name: "Closed", sortOrder: 5, isClosedStage: true },
] as const;

async function requireLawyerOrAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!["admin", "lawyer"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

async function requireFirmMember(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  return member;
}

export const matterStagesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const db = await getDb();
    if (!db) return [];

    let rows = await db
      .select()
      .from(matterStages)
      .where(eq(matterStages.firmId, member.firmId))
      .orderBy(asc(matterStages.sortOrder), asc(matterStages.id));

    if (rows.length === 0) {
      await db.insert(matterStages).values(
        DEFAULT_STAGES.map((s) => ({
          firmId: member.firmId,
          name: s.name,
          sortOrder: s.sortOrder,
          isClosedStage: s.isClosedStage,
          color: "#111827",
        }))
      );
      rows = await db
        .select()
        .from(matterStages)
        .where(eq(matterStages.firmId, member.firmId))
        .orderBy(asc(matterStages.sortOrder), asc(matterStages.id));
    }

    return rows;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().max(7).optional(),
        isClosedStage: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const existing = await db
          .select({ sortOrder: matterStages.sortOrder })
          .from(matterStages)
          .where(eq(matterStages.firmId, member.firmId))
          .orderBy(asc(matterStages.sortOrder));
        sortOrder = existing.length ? (existing[existing.length - 1]?.sortOrder ?? 0) + 1 : 0;
      }

      const [result] = await db.insert(matterStages).values({
        firmId: member.firmId,
        name: input.name,
        color: input.color ?? "#111827",
        isClosedStage: input.isClosedStage ?? false,
        sortOrder,
      });

      return { id: Number((result as { insertId?: number }).insertId ?? 0) };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        color: z.string().max(7).optional().nullable(),
        isClosedStage: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(matterStages)
        .where(and(eq(matterStages.id, input.id), eq(matterStages.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      await db
        .update(matterStages)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.isClosedStage !== undefined ? { isClosedStage: data.isClosedStage } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        })
        .where(eq(matterStages.id, id));

      return { success: true as const };
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        orderedIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select()
        .from(matterStages)
        .where(
          and(eq(matterStages.firmId, member.firmId), inArray(matterStages.id, input.orderedIds))
        );
      if (existing.length !== input.orderedIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid stage ids" });
      }

      await Promise.all(
        input.orderedIds.map((id, index) =>
          db.update(matterStages).set({ sortOrder: index }).where(eq(matterStages.id, id))
        )
      );

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reassignToStageId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireLawyerOrAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(matterStages)
        .where(and(eq(matterStages.id, input.id), eq(matterStages.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const using = await db
        .select({ id: cases.id })
        .from(cases)
        .where(and(eq(cases.firmId, member.firmId), eq(cases.matterStageId, input.id)))
        .limit(1);

      if (using.length > 0) {
        if (!input.reassignToStageId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stage is in use; provide reassignToStageId to move cases first",
          });
        }
        if (input.reassignToStageId === input.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reassign to the same stage" });
        }
        const [target] = await db
          .select()
          .from(matterStages)
          .where(
            and(
              eq(matterStages.id, input.reassignToStageId),
              eq(matterStages.firmId, member.firmId)
            )
          )
          .limit(1);
        if (!target) throw new TRPCError({ code: "BAD_REQUEST", message: "Reassign target not found" });

        await db
          .update(cases)
          .set({ matterStageId: input.reassignToStageId })
          .where(and(eq(cases.firmId, member.firmId), eq(cases.matterStageId, input.id)));
      }

      await db.delete(matterStages).where(eq(matterStages.id, input.id));
      return { success: true as const };
    }),
});
