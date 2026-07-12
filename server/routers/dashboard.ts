import { TRPCError } from "@trpc/server";
import { desc, eq, and, or } from "drizzle-orm";
import { z } from "zod";
import {
  getCasesByFirm,
  getCasesByClientId,
  getClientByUserId,
  getFirmMemberByUserId,
  getInvoicesByFirm,
  getInvoicesByClient,
  getMessagesByCase,
  getUnreadMessageCount,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cases, invoices, caseEvents, messages } from "../../drizzle/schema";

export const dashboardRouter = router({
  lawyerStats: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
    const allCases = await getCasesByFirm(member.firmId);
    const allInvoices = await getInvoicesByFirm(member.firmId);
    const openCases = allCases.filter(c => c.status === "open").length;
    const pendingCases = allCases.filter(c => c.status === "pending").length;
    const pendingInvoices = allInvoices.filter(r => r.invoice.status === "sent").length;
    const overdueInvoices = allInvoices.filter(r => r.invoice.status === "overdue").length;
    const totalRevenue = allInvoices
      .filter(r => r.invoice.status === "paid")
      .reduce((sum, r) => sum + Number(r.invoice.total), 0);
    const upcomingDeadlines = allCases
      .filter(c => c.deadline && c.deadline > new Date() && c.status !== "closed" && c.status !== "archived")
      .sort((a, b) => (a.deadline!.getTime()) - (b.deadline!.getTime()))
      .slice(0, 5);
    return { openCases, pendingCases, pendingInvoices, overdueInvoices, totalRevenue, upcomingDeadlines };
  }),

  clientStats: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
    const myCases = await getCasesByClientId(client.id);
    const myInvoices = await getInvoicesByClient(client.id);
    const unreadMessages = await getUnreadMessageCount(ctx.user.id, client.firmId);
    const outstandingBalance = myInvoices
      .filter(inv => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => sum + Number(inv.total), 0);
    return {
      totalCases: myCases.length,
      openCases: myCases.filter(c => c.status === "open").length,
      unreadMessages,
      outstandingBalance,
      pendingInvoices: myInvoices.filter(inv => inv.status === "sent" || inv.status === "overdue").length,
    };
  }),

  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return [];
    const db = await getDb();
    if (!db) return [];
    const recentEvents = await db.select({ event: caseEvents, case: cases })
      .from(caseEvents)
      .innerJoin(cases, eq(caseEvents.caseId, cases.id))
      .where(eq(cases.firmId, member.firmId))
      .orderBy(desc(caseEvents.createdAt))
      .limit(20);
    return recentEvents;
  }),
});

