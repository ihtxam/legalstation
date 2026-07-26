import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  calendarConnections,
  calendarImportedEvents,
  calendarPersonalEvents,
  calendarEventLinks,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getFirmMemberByUserId } from "../db";
import { listUserAgenda } from "../calendar/agenda";
import { syncConnection } from "../calendar/sync";
import { encryptSecret } from "../calendar/tokenCrypto";
import { discoverIcloudCalendarUrl } from "../calendar/providers/icloud";
import { googleCalendarConfigured } from "../calendar/providers/google";
import { microsoftCalendarConfigured } from "../calendar/providers/microsoft";

function publicConnection(row: typeof calendarConnections.$inferSelect) {
  return {
    id: row.id,
    provider: row.provider,
    accountEmail: row.accountEmail,
    externalCalendarName: row.externalCalendarName,
    syncEnabled: row.syncEnabled,
    syncDirection: row.syncDirection,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
  };
}

export const calendarRouter = router({
  providersStatus: protectedProcedure.query(async () => ({
    google: await googleCalendarConfigured(),
    microsoft: await microsoftCalendarConfigured(),
    icloud: true,
  })),

  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, ctx.user.id));
    return rows.map(publicConnection);
  }),

  connectIcloud: protectedProcedure
    .input(
      z.object({
        appleId: z.string().email(),
        appPassword: z.string().min(6),
        syncDirection: z.enum(["both", "push", "pull"]).optional().default("both"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const calendarUrl = await discoverIcloudCalendarUrl(input.appleId, input.appPassword);
      const member = await getFirmMemberByUserId(ctx.user.id);

      const [existing] = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.userId, ctx.user.id),
            eq(calendarConnections.provider, "icloud")
          )
        )
        .limit(1);

      const values = {
        userId: ctx.user.id,
        firmId: member?.firmId ?? null,
        provider: "icloud" as const,
        accountEmail: input.appleId,
        accessTokenEnc: null,
        refreshTokenEnc: encryptSecret(input.appPassword),
        tokenExpiresAt: null,
        externalCalendarId: calendarUrl,
        externalCalendarName: "iCloud",
        caldavUrl: calendarUrl,
        caldavUsername: input.appleId,
        syncEnabled: true,
        syncDirection: input.syncDirection,
        lastError: null,
      };

      if (existing) {
        await db.update(calendarConnections).set(values).where(eq(calendarConnections.id, existing.id));
        return { id: existing.id };
      }
      const result = await db.insert(calendarConnections).values(values);
      return { id: result[0].insertId as number };
    }),

  updateConnection: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        syncEnabled: z.boolean().optional(),
        syncDirection: z.enum(["both", "push", "pull"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(calendarConnections)
        .where(
          and(eq(calendarConnections.id, input.id), eq(calendarConnections.userId, ctx.user.id))
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(calendarConnections)
        .set({
          syncEnabled: input.syncEnabled ?? row.syncEnabled,
          syncDirection: input.syncDirection ?? row.syncDirection,
        })
        .where(eq(calendarConnections.id, row.id));
      return { success: true as const };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(calendarConnections)
        .where(
          and(eq(calendarConnections.id, input.id), eq(calendarConnections.userId, ctx.user.id))
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(calendarEventLinks).where(eq(calendarEventLinks.connectionId, row.id));
      await db
        .delete(calendarImportedEvents)
        .where(eq(calendarImportedEvents.connectionId, row.id));
      await db.delete(calendarConnections).where(eq(calendarConnections.id, row.id));
      return { success: true as const };
    }),

  syncNow: protectedProcedure
    .input(z.object({ id: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.userId, ctx.user.id));
      const targets = input?.id ? rows.filter((r) => r.id === input.id) : rows;
      if (!targets.length) throw new TRPCError({ code: "NOT_FOUND", message: "No calendar connected" });
      const results = [];
      for (const t of targets) {
        results.push({ id: t.id, ...(await syncConnection(t.id)) });
      }
      return { results };
    }),

  agenda: protectedProcedure
    .input(
      z.object({
        from: z.number(),
        to: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listUserAgenda({
        userId: ctx.user.id,
        from: new Date(input.from),
        to: new Date(input.to),
      });
    }),

  createPersonalEvent: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        location: z.string().optional(),
        startsAt: z.number(),
        endsAt: z.number(),
        allDay: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.endsAt <= input.startsAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start" });
      }
      const member = await getFirmMemberByUserId(ctx.user.id);
      const result = await db.insert(calendarPersonalEvents).values({
        userId: ctx.user.id,
        firmId: member?.firmId ?? null,
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        allDay: input.allDay,
      });
      const id = result[0].insertId as number;
      // Best-effort push to connected calendars
      const conns = await db
        .select()
        .from(calendarConnections)
        .where(
          and(eq(calendarConnections.userId, ctx.user.id), eq(calendarConnections.syncEnabled, true))
        );
      for (const c of conns) {
        try {
          await syncConnection(c.id);
        } catch {
          // keep creating even if sync fails
        }
      }
      return { id };
    }),

  deletePersonalEvent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(calendarPersonalEvents)
        .where(
          and(
            eq(calendarPersonalEvents.id, input.id),
            eq(calendarPersonalEvents.userId, ctx.user.id)
          )
        );
      return { success: true as const };
    }),
});
