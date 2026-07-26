import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import {
  announcementDismissals,
  platformAnnouncements,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getFirmMemberByUserId } from "../db";
import { isAnnouncementVisibleTo } from "../announcementVisibility";

export const announcementsRouter = router({
  /** Active announcements for the current firm user (not dismissed). */
  activeForMe: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "superadmin") return [];
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return [];
    const db = await getDb();
    if (!db) return [];

    const now = new Date();
    const rows = await db
      .select()
      .from(platformAnnouncements)
      .where(
        and(
          eq(platformAnnouncements.isActive, true),
          lte(platformAnnouncements.startsAt, now),
          or(isNull(platformAnnouncements.endsAt), gte(platformAnnouncements.endsAt, now))
        )
      )
      .orderBy(desc(platformAnnouncements.createdAt));

    const visible = rows.filter((a) =>
      isAnnouncementVisibleTo(a, {
        firmRole: member.firmRole,
        accountCreatedAt: ctx.user.createdAt ?? null,
      })
    );

    const dismissed = await db
      .select()
      .from(announcementDismissals)
      .where(eq(announcementDismissals.userId, ctx.user.id));
    const dismissedIds = new Set(dismissed.map((d) => d.announcementId));
    return visible.filter((a) => !dismissedIds.has(a.id));
  }),

  dismiss: protectedProcedure
    .input(z.object({ announcementId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select()
        .from(announcementDismissals)
        .where(
          and(
            eq(announcementDismissals.announcementId, input.announcementId),
            eq(announcementDismissals.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!existing[0]) {
        await db.insert(announcementDismissals).values({
          announcementId: input.announcementId,
          userId: ctx.user.id,
        });
      }
      return { success: true as const };
    }),
});
