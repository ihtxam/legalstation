import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import {
  supportTicketAttachments,
  supportTicketMessages,
  supportTickets,
  users,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getFirmMemberByUserId } from "../db";
import {
  countFirmTicketsThisMonth,
  getFirmAdminEmails,
  getFirmName,
  getPlatformNotifyEmails,
  getTicketsPerMonthLimit,
  isFirmAdminRole,
  nextTicketNumber,
  notifyTicketCreated,
  notifyTicketReply,
  notifyTicketStatusChange,
  resolvedAutoCloseAt,
  ticketHasUnreadForFirm,
} from "../supportTickets";

const attachmentInput = z.object({
  fileName: z.string().min(1).max(255),
  fileKey: z.string().min(1).max(512),
  fileUrl: z.string().min(1).max(1024),
  mimeType: z.string().max(128).optional().nullable(),
  size: z.number().int().min(0).max(20 * 1024 * 1024).default(0),
});

async function requireFirmAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !isFirmAdminRole(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only firm admins can manage support tickets" });
  }
  return member;
}

async function loadTicketThread(ticketId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const messages = await db
    .select({
      id: supportTicketMessages.id,
      ticketId: supportTicketMessages.ticketId,
      authorUserId: supportTicketMessages.authorUserId,
      authorKind: supportTicketMessages.authorKind,
      body: supportTicketMessages.body,
      createdAt: supportTicketMessages.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(supportTicketMessages.authorUserId, users.id))
    .where(eq(supportTicketMessages.ticketId, ticketId))
    .orderBy(supportTicketMessages.createdAt);
  const attachments = await db
    .select()
    .from(supportTicketAttachments)
    .where(eq(supportTicketAttachments.ticketId, ticketId));
  return { messages, attachments };
}

export const supportTicketsRouter = router({
  quota: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmAdmin(ctx.user.id);
    const limit = await getTicketsPerMonthLimit();
    const used = await countFirmTicketsThisMonth(member.firmId);
    return { limit, used, remaining: Math.max(0, limit - used) };
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "superadmin") return 0;
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member || !isFirmAdminRole(member.firmRole)) return 0;
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select({
        lastSuperadminReplyAt: supportTickets.lastSuperadminReplyAt,
        firmLastViewedAt: supportTickets.firmLastViewedAt,
        status: supportTickets.status,
      })
      .from(supportTickets)
      .where(eq(supportTickets.firmId, member.firmId));
    return rows.filter(ticketHasUnreadForFirm).length;
  }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.firmId, member.firmId))
      .orderBy(desc(supportTickets.updatedAt))
      .limit(100);
    return rows.map((t) => ({
      ...t,
      hasUnread: ticketHasUnreadForFirm(t),
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, input.id), eq(supportTickets.firmId, member.firmId)))
        .limit(1);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(supportTickets)
        .set({ firmLastViewedAt: new Date() })
        .where(eq(supportTickets.id, ticket.id));
      const thread = await loadTicketThread(ticket.id);
      return { ticket: { ...ticket, hasUnread: false }, ...thread };
    }),

  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(3).max(255),
        body: z.string().min(10).max(8000),
        sensitivity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        attachments: z.array(attachmentInput).max(5).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const limit = await getTicketsPerMonthLimit();
      const used = await countFirmTicketsThisMonth(member.firmId);
      if (used >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Monthly ticket limit reached (${used}/${limit}). Contact Cliavo support by email if urgent.`,
        });
      }

      const ticketNumber = await nextTicketNumber();
      const now = new Date();
      const [ins] = await db.insert(supportTickets).values({
        ticketNumber,
        firmId: member.firmId,
        createdByUserId: ctx.user.id,
        subject: input.subject.trim(),
        body: input.body.trim(),
        sensitivity: input.sensitivity,
        status: "open",
        lastFirmReplyAt: now,
        firmLastViewedAt: now,
      });
      const ticketId = Number(ins.insertId);

      const [msgIns] = await db.insert(supportTicketMessages).values({
        ticketId,
        authorUserId: ctx.user.id,
        authorKind: "firm",
        body: input.body.trim(),
      });
      const messageId = Number(msgIns.insertId);

      for (const a of input.attachments) {
        await db.insert(supportTicketAttachments).values({
          ticketId,
          messageId,
          fileName: a.fileName,
          fileKey: a.fileKey,
          fileUrl: a.fileUrl,
          mimeType: a.mimeType || null,
          size: a.size,
        });
      }

      const firmName = await getFirmName(member.firmId);
      void notifyTicketCreated({
        ticketNumber,
        subject: input.subject.trim(),
        body: input.body.trim(),
        sensitivity: input.sensitivity,
        firmName,
        creatorName: ctx.user.name || "Firm admin",
        creatorEmail: ctx.user.email || "",
      }).catch((e) => console.warn("[SupportTicket] notify create", e));

      return { id: ticketId, ticketNumber };
    }),

  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.number(),
        body: z.string().min(1).max(8000),
        attachments: z.array(attachmentInput).max(5).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.firmId, member.firmId)))
        .limit(1);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status === "closed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This ticket is closed" });
      }

      const now = new Date();
      const nextStatus =
        ticket.status === "resolved" || ticket.status === "responded"
          ? "responded"
          : ticket.status === "open"
            ? "open"
            : "responded";

      const [msgIns] = await db.insert(supportTicketMessages).values({
        ticketId: ticket.id,
        authorUserId: ctx.user.id,
        authorKind: "firm",
        body: input.body.trim(),
      });
      const messageId = Number(msgIns.insertId);

      for (const a of input.attachments) {
        await db.insert(supportTicketAttachments).values({
          ticketId: ticket.id,
          messageId,
          fileName: a.fileName,
          fileKey: a.fileKey,
          fileUrl: a.fileUrl,
          mimeType: a.mimeType || null,
          size: a.size,
        });
      }

      await db
        .update(supportTickets)
        .set({
          status: nextStatus,
          lastFirmReplyAt: now,
          firmLastViewedAt: now,
          resolvedAt: null,
          autoCloseAt: null,
          closedAt: null,
          updatedAt: now,
        })
        .where(eq(supportTickets.id, ticket.id));

      const platformEmails = await getPlatformNotifyEmails();
      void notifyTicketReply({
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        replyBody: input.body.trim(),
        toEmails: platformEmails.map((email) => ({ email })),
        fromLabel: ctx.user.name || "Firm admin",
        linkPath: "/superadmin",
      }).catch((e) => console.warn("[SupportTicket] notify firm reply", e));

      return { success: true as const };
    }),
});
