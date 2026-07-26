import { TRPCError } from "@trpc/server";
import { desc, eq, and, sql } from "drizzle-orm";
import {
  getCasesByFirm,
  getCasesByClientId,
  getClientByUserId,
  getClientsByFirm,
  getFirmMemberByUserId,
  getInvoicesByFirm,
  getInvoicesByClient,
  getUnreadMessageCount,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cases, caseEvents, documents } from "../../drizzle/schema";

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

  /** Firm-admin analytics: cases, revenue, invoices, documents, clients */
  adminAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member || member.firmRole !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const allCases = await getCasesByFirm(member.firmId);
    const allInvoices = await getInvoicesByFirm(member.firmId);
    const allClients = await getClientsByFirm(member.firmId);

    const db = await getDb();
    let documentCount = 0;
    if (db) {
      const docResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(documents)
        .where(and(eq(documents.firmId, member.firmId), eq(documents.isDeleted, false)));
      documentCount = Number(docResult[0]?.count ?? 0);
    }

    const casesByStatus = {
      open: allCases.filter(c => c.status === "open").length,
      pending: allCases.filter(c => c.status === "pending").length,
      closed: allCases.filter(c => c.status === "closed").length,
      archived: allCases.filter(c => c.status === "archived").length,
    };

    const invoicesByStatus = {
      draft: allInvoices.filter(r => r.invoice.status === "draft").length,
      sent: allInvoices.filter(r => r.invoice.status === "sent").length,
      paid: allInvoices.filter(r => r.invoice.status === "paid").length,
      overdue: allInvoices.filter(r => r.invoice.status === "overdue").length,
      cancelled: allInvoices.filter(r => r.invoice.status === "cancelled").length,
    };

    const totalRevenue = allInvoices
      .filter(r => r.invoice.status === "paid")
      .reduce((sum, r) => sum + Number(r.invoice.total), 0);
    const outstanding = allInvoices
      .filter(r => r.invoice.status === "sent" || r.invoice.status === "overdue")
      .reduce((sum, r) => sum + Number(r.invoice.total), 0);

    // Last 6 months revenue (paid invoices)
    const now = new Date();
    const revenueByMonth: Array<{ month: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const revenue = allInvoices
        .filter(r => {
          if (r.invoice.status !== "paid") return false;
          const paidAt = r.invoice.paidAt || r.invoice.updatedAt || r.invoice.createdAt;
          const t = new Date(paidAt).getTime();
          return t >= d.getTime() && t < next.getTime();
        })
        .reduce((sum, r) => sum + Number(r.invoice.total), 0);
      revenueByMonth.push({ month: label, revenue });
    }

    return {
      totals: {
        cases: allCases.length,
        clients: allClients.length,
        documents: documentCount,
        totalRevenue,
        outstanding,
      },
      casesByStatus,
      invoicesByStatus,
      revenueByMonth,
    };
  }),
});

