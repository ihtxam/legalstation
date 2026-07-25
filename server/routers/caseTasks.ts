import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCaseEvent,
  getDb,
  getFirmMemberByUserId,
} from "../db";
import { assertCaseAccess } from "../access";
import { caseTasks, users } from "../../drizzle/schema";
import { mergeMentionIds, notifyMentionedUsers } from "../mentions";
import { getAppBaseUrl } from "../tenant";

async function requireStaff(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

export const caseTasksRouter = router({
  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCaseAccess(ctx.user.id, input.caseId);
      const db = await getDb();
      if (!db) return [];

      const tasks = await db
        .select()
        .from(caseTasks)
        .where(eq(caseTasks.caseId, input.caseId))
        .orderBy(asc(caseTasks.sortOrder), asc(caseTasks.id));

      const assigneeIds = Array.from(
        new Set(tasks.map((t) => t.assigneeUserId).filter((id): id is number => id != null))
      );
      const nameById = new Map<number, string | null>();
      if (assigneeIds.length) {
        const rows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, assigneeIds));
        for (const r of rows) nameById.set(r.id, r.name);
      }

      return tasks.map((t) => ({
        ...t,
        mentionedUserIds: t.mentionedUserIds
          ? (JSON.parse(t.mentionedUserIds) as number[])
          : [],
        assigneeName: t.assigneeUserId ? nameById.get(t.assigneeUserId) ?? null : null,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        caseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        parentTaskId: z.number().optional().nullable(),
        matterStageId: z.number().optional().nullable(),
        assigneeUserId: z.number().optional().nullable(),
        dueAt: z.string().optional().nullable(),
        mentionedUserIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const { caseRow } = await assertCaseAccess(ctx.user.id, input.caseId);
      if (caseRow.firmId !== member.firmId) throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.parentTaskId) {
        const [parent] = await db
          .select()
          .from(caseTasks)
          .where(
            and(
              eq(caseTasks.id, input.parentTaskId),
              eq(caseTasks.caseId, input.caseId),
              eq(caseTasks.firmId, member.firmId)
            )
          )
          .limit(1);
        if (!parent) throw new TRPCError({ code: "BAD_REQUEST", message: "Parent task not found" });
      }

      const mentions = mergeMentionIds(input.mentionedUserIds, input.description);

      const [result] = await db.insert(caseTasks).values({
        firmId: member.firmId,
        caseId: input.caseId,
        title: input.title,
        description: input.description ?? null,
        parentTaskId: input.parentTaskId ?? null,
        matterStageId: input.matterStageId ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        mentionedUserIds: mentions.length ? JSON.stringify(mentions) : null,
        createdByUserId: ctx.user.id,
        status: "todo",
      });

      const id = Number((result as { insertId?: number }).insertId ?? 0);

      await createCaseEvent({
        caseId: input.caseId,
        authorUserId: ctx.user.id,
        eventType: "note",
        visibility: "internal",
        title: "Task created",
        content: `Task: ${input.title}${input.description ? ` — ${input.description}` : ""}`,
      }).catch((err) => console.error("[caseTasks] event:", err));

      if (mentions.length) {
        await notifyMentionedUsers({
          userIds: mentions,
          actorName: ctx.user.name || ctx.user.email || "A colleague",
          subject: `Mentioned on task: ${input.title}`,
          preview: input.description || input.title,
          url: `${getAppBaseUrl(ctx.req)}/cases/${input.caseId}`,
          excludeUserId: ctx.user.id,
        });
      }

      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        parentTaskId: z.number().optional().nullable(),
        matterStageId: z.number().optional().nullable(),
        assigneeUserId: z.number().optional().nullable(),
        dueAt: z.string().optional().nullable(),
        status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
        mentionedUserIds: z.array(z.number()).optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db
        .select()
        .from(caseTasks)
        .where(and(eq(caseTasks.id, input.id), eq(caseTasks.firmId, member.firmId)))
        .limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const description =
        input.description !== undefined ? input.description : task.description;
      const mentions =
        input.mentionedUserIds !== undefined || input.description !== undefined
          ? mergeMentionIds(
              input.mentionedUserIds ??
                (task.mentionedUserIds ? (JSON.parse(task.mentionedUserIds) as number[]) : []),
              description
            )
          : null;

      const patch: Partial<typeof caseTasks.$inferInsert> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.parentTaskId !== undefined) patch.parentTaskId = input.parentTaskId;
      if (input.matterStageId !== undefined) patch.matterStageId = input.matterStageId;
      if (input.assigneeUserId !== undefined) patch.assigneeUserId = input.assigneeUserId;
      if (input.dueAt !== undefined) patch.dueAt = input.dueAt ? new Date(input.dueAt) : null;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      if (input.status !== undefined) {
        patch.status = input.status;
        patch.completedAt =
          input.status === "done" ? new Date() : input.status === "cancelled" ? task.completedAt : null;
      }
      if (mentions) patch.mentionedUserIds = mentions.length ? JSON.stringify(mentions) : null;

      await db.update(caseTasks).set(patch).where(eq(caseTasks.id, input.id));

      if (mentions?.length) {
        await notifyMentionedUsers({
          userIds: mentions,
          actorName: ctx.user.name || ctx.user.email || "A colleague",
          subject: `Mentioned on task: ${input.title ?? task.title}`,
          preview: (description as string) || input.title || task.title,
          url: `${getAppBaseUrl(ctx.req)}/cases/${task.caseId}`,
          excludeUserId: ctx.user.id,
        });
      }

      return { success: true as const };
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["todo", "in_progress", "done", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db
        .select()
        .from(caseTasks)
        .where(and(eq(caseTasks.id, input.id), eq(caseTasks.firmId, member.firmId)))
        .limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(caseTasks)
        .set({
          status: input.status,
          completedAt: input.status === "done" ? new Date() : null,
        })
        .where(eq(caseTasks.id, input.id));

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db
        .select()
        .from(caseTasks)
        .where(and(eq(caseTasks.id, input.id), eq(caseTasks.firmId, member.firmId)))
        .limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      // Detach children then delete
      await db
        .update(caseTasks)
        .set({ parentTaskId: null })
        .where(eq(caseTasks.parentTaskId, input.id));
      await db.delete(caseTasks).where(eq(caseTasks.id, input.id));

      return { success: true as const };
    }),
});
