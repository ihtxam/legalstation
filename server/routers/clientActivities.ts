import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getClientById, getDb, getFirmMemberByUserId } from "../db";
import { clientActivities, users } from "../../drizzle/schema";
import { getUserEmailById, mergeMentionIds, notifyMentionedUsers } from "../mentions";
import { getAppBaseUrl } from "../tenant";
import { sendEmail } from "../email";

async function requireStaff(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "lawyer", "assistant"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

const activityType = z.enum(["note", "meeting", "todo", "next_action", "reminder"]);

export const clientActivitiesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        type: activityType.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const client = await getClientById(input.clientId, member.firmId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      const db = await getDb();
      if (!db) return [];

      const conditions = [
        eq(clientActivities.firmId, member.firmId),
        eq(clientActivities.clientId, input.clientId),
      ];
      if (input.type) conditions.push(eq(clientActivities.type, input.type));

      const rows = await db
        .select()
        .from(clientActivities)
        .where(and(...conditions))
        .orderBy(desc(clientActivities.createdAt));

      const assigneeIds = Array.from(
        new Set(rows.map((r) => r.assigneeUserId).filter((id): id is number => id != null))
      );
      const nameById = new Map<number, string | null>();
      if (assigneeIds.length) {
        const usersRows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, assigneeIds));
        for (const u of usersRows) nameById.set(u.id, u.name);
      }

      return rows.map((r) => ({
        ...r,
        mentionedUserIds: r.mentionedUserIds
          ? (JSON.parse(r.mentionedUserIds) as number[])
          : [],
        assigneeName: r.assigneeUserId ? nameById.get(r.assigneeUserId) ?? null : null,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        type: activityType,
        title: z.string().min(1).max(255),
        body: z.string().optional(),
        dueAt: z.string().optional().nullable(),
        remindAt: z.string().optional().nullable(),
        assigneeUserId: z.number().optional().nullable(),
        mentionedUserIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const client = await getClientById(input.clientId, member.firmId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const mentions = mergeMentionIds(input.mentionedUserIds, input.body);

      const [result] = await db.insert(clientActivities).values({
        firmId: member.firmId,
        clientId: input.clientId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        remindAt: input.remindAt ? new Date(input.remindAt) : null,
        assigneeUserId: input.assigneeUserId ?? null,
        mentionedUserIds: mentions.length ? JSON.stringify(mentions) : null,
        createdByUserId: ctx.user.id,
      });

      const id = Number((result as { insertId?: number }).insertId ?? 0);
      const clientUrl = `${getAppBaseUrl(ctx.req)}/clients/${input.clientId}`;

      if (mentions.length) {
        await notifyMentionedUsers({
          userIds: mentions,
          actorName: ctx.user.name || ctx.user.email || "A colleague",
          subject: `Mentioned on client activity: ${input.title}`,
          preview: input.body || input.title,
          url: clientUrl,
          excludeUserId: ctx.user.id,
        });
      }

      if (input.assigneeUserId && input.assigneeUserId !== ctx.user.id) {
        const toEmail = await getUserEmailById(input.assigneeUserId);
        if (toEmail && (input.type === "reminder" || input.dueAt || input.remindAt)) {
          await sendEmail({
            to: [{ email: toEmail }],
            subject: `Assigned: ${input.title}`,
            htmlContent: `
              <html><body style="font-family: Inter, sans-serif;">
                <p>You were assigned a <strong>${input.type}</strong>: ${input.title}</p>
                ${input.body ? `<p>${input.body.replace(/</g, "&lt;").slice(0, 500)}</p>` : ""}
                <p><a href="${clientUrl}">Open client</a></p>
              </body></html>
            `,
          }).catch((err) => console.error("[clientActivities] assignee email:", err));
        }
      }

      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        body: z.string().optional().nullable(),
        dueAt: z.string().optional().nullable(),
        remindAt: z.string().optional().nullable(),
        assigneeUserId: z.number().optional().nullable(),
        mentionedUserIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(clientActivities)
        .where(and(eq(clientActivities.id, input.id), eq(clientActivities.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const body = input.body !== undefined ? input.body : row.body;
      const mentions =
        input.mentionedUserIds !== undefined || input.body !== undefined
          ? mergeMentionIds(
              input.mentionedUserIds ??
                (row.mentionedUserIds ? (JSON.parse(row.mentionedUserIds) as number[]) : []),
              body
            )
          : null;

      await db
        .update(clientActivities)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.dueAt !== undefined
            ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
            : {}),
          ...(input.remindAt !== undefined
            ? { remindAt: input.remindAt ? new Date(input.remindAt) : null }
            : {}),
          ...(input.assigneeUserId !== undefined
            ? { assigneeUserId: input.assigneeUserId }
            : {}),
          ...(mentions
            ? { mentionedUserIds: mentions.length ? JSON.stringify(mentions) : null }
            : {}),
        })
        .where(eq(clientActivities.id, input.id));

      if (mentions?.length) {
        await notifyMentionedUsers({
          userIds: mentions,
          actorName: ctx.user.name || ctx.user.email || "A colleague",
          subject: `Mentioned on client activity: ${input.title ?? row.title}`,
          preview: (body as string) || input.title || row.title,
          url: `${getAppBaseUrl(ctx.req)}/clients/${row.clientId}`,
          excludeUserId: ctx.user.id,
        });
      }

      return { success: true as const };
    }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        completed: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(clientActivities)
        .where(and(eq(clientActivities.id, input.id), eq(clientActivities.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(clientActivities)
        .set({ completedAt: input.completed ? new Date() : null })
        .where(eq(clientActivities.id, input.id));

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db
        .select()
        .from(clientActivities)
        .where(and(eq(clientActivities.id, input.id), eq(clientActivities.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(clientActivities).where(eq(clientActivities.id, input.id));
      return { success: true as const };
    }),
});
