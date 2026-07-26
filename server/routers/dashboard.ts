import { TRPCError } from "@trpc/server";
import { desc, eq, and, inArray } from "drizzle-orm";
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
import {
  cases,
  caseEvents,
  firmClientPackages,
  clientSubscriptions,
  firmOndemandServices,
  serviceOrders,
} from "../../drizzle/schema";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

/** Normalize package price to monthly recurring revenue equivalent. */
function packageMonthlyEquivalent(
  pkg: {
    monthlyPrice?: string | null;
    biannualPrice?: string | null;
    yearlyPrice?: string | null;
    price: string;
    billingInterval: string;
  },
  interval: "monthly" | "biannual" | "yearly"
) {
  if (interval === "monthly") {
    const v = Number(pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : 0));
    return v > 0 ? v : 0;
  }
  if (interval === "biannual") {
    const v = Number(pkg.biannualPrice ?? 0);
    return v > 0 ? v / 6 : 0;
  }
  const v = Number(pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : 0));
  return v > 0 ? v / 12 : 0;
}

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

  /** Firm-admin analytics: cases, billing, messaging volume, upselling targets. */
  adminAnalytics: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    const { getFirmCapabilityMatrix } = await import("../firmPermissions");
    const { canAccessAdminConsole } = await import("@shared/roles");
    const { matrix } = await getFirmCapabilityMatrix(member.firmId);
    if (!canAccessAdminConsole(member.firmRole, matrix)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    const db = await getDb();
    const allCases = await getCasesByFirm(member.firmId);
    const allInvoices = await getInvoicesByFirm(member.firmId);
    const allClients = await getClientsByFirm(member.firmId);
    const unread = await getUnreadMessageCount(ctx.user.id, member.firmId);

    const casesByStatus = {
      open: allCases.filter((c) => c.status === "open").length,
      pending: allCases.filter((c) => c.status === "pending").length,
      closed: allCases.filter((c) => c.status === "closed").length,
      archived: allCases.filter((c) => c.status === "archived").length,
    };

    const casesByTypeMap: Record<string, number> = {};
    for (const c of allCases) {
      const key = c.type || "other";
      casesByTypeMap[key] = (casesByTypeMap[key] || 0) + 1;
    }
    const casesByType = Object.entries(casesByTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const invoicesByStatus = {
      draft: allInvoices.filter((r) => r.invoice.status === "draft").length,
      sent: allInvoices.filter((r) => r.invoice.status === "sent").length,
      paid: allInvoices.filter((r) => r.invoice.status === "paid").length,
      overdue: allInvoices.filter((r) => r.invoice.status === "overdue").length,
      cancelled: allInvoices.filter((r) => r.invoice.status === "cancelled").length,
    };

    const paidRevenue = allInvoices
      .filter((r) => r.invoice.status === "paid")
      .reduce((sum, r) => sum + Number(r.invoice.total), 0);
    const outstanding = allInvoices
      .filter((r) => r.invoice.status === "sent" || r.invoice.status === "overdue")
      .reduce((sum, r) => sum + Number(r.invoice.total), 0);

    const revenueByMonthMap: Record<string, number> = {};
    for (const row of allInvoices) {
      if (row.invoice.status !== "paid" || !row.invoice.paidAt) continue;
      const key = monthKey(new Date(row.invoice.paidAt));
      revenueByMonthMap[key] = (revenueByMonthMap[key] || 0) + Number(row.invoice.total);
    }

    // Fill last 12 calendar months so charts are continuous
    const now = new Date();
    const revenueByMonth: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = monthKey(addMonths(now, -i));
      revenueByMonth.push({ month: m, total: revenueByMonthMap[m] || 0 });
    }

    // ── Upselling catalog + subscriptions ─────────────────────────────────
    const packages = db
      ? await db
          .select()
          .from(firmClientPackages)
          .where(eq(firmClientPackages.firmId, member.firmId))
      : [];
    const subscriptions = db
      ? await db
          .select()
          .from(clientSubscriptions)
          .where(eq(clientSubscriptions.firmId, member.firmId))
      : [];
    const services = db
      ? await db
          .select()
          .from(firmOndemandServices)
          .where(eq(firmOndemandServices.firmId, member.firmId))
      : [];
    const orders = db
      ? await db
          .select()
          .from(serviceOrders)
          .where(
            and(
              eq(serviceOrders.firmId, member.firmId),
              inArray(serviceOrders.status, [
                "paid",
                "awaiting_acceptance",
                "awaiting_intake",
                "ready_for_firm",
                "accepted",
                "in_progress",
                "delivered",
                "revision_requested",
                "completed",
              ])
            )
          )
      : [];

    const pkgById = new Map(packages.map((p) => [p.id, p]));
    const activeSubs = subscriptions.filter((s) => s.status === "active");
    let packageMrr = 0;
    const packageMix: Record<string, number> = {};
    for (const sub of activeSubs) {
      const pkg = pkgById.get(sub.packageId);
      if (!pkg) continue;
      const mrr = packageMonthlyEquivalent(
        pkg,
        sub.billingInterval as "monthly" | "biannual" | "yearly"
      );
      packageMrr += mrr;
      packageMix[pkg.name] = (packageMix[pkg.name] || 0) + 1;
    }

    const serviceRevenue = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
    const serviceRevenueByMonthMap: Record<string, number> = {};
    for (const o of orders) {
      const when = o.paidAt || o.createdAt;
      if (!when) continue;
      const key = monthKey(new Date(when));
      serviceRevenueByMonthMap[key] = (serviceRevenueByMonthMap[key] || 0) + Number(o.subtotal || 0);
    }
    const serviceRevenueByMonth = revenueByMonth.map((r) => ({
      month: r.month,
      total: serviceRevenueByMonthMap[r.month] || 0,
    }));

    const activeClients = allClients.filter((c) => c.status === "active" || c.status === "invited");
    const subscribedClientIds = new Set(activeSubs.map((s) => s.clientId));
    const clientsWithoutPackage = activeClients.filter((c) => !subscribedClientIds.has(c.id)).length;
    const conversionRate =
      activeClients.length > 0 ? activeSubs.length / activeClients.length : 0;

    const activePackages = packages.filter((p) => p.isActive);
    const avgPackageMonthly =
      activePackages.length > 0
        ? activePackages.reduce((sum, p) => {
            const m = Number(p.monthlyPrice || 0);
            const y = Number(p.yearlyPrice || 0);
            const b = Number(p.biannualPrice || 0);
            const equiv =
              m > 0 ? m : y > 0 ? y / 12 : b > 0 ? b / 6 : Number(p.price || 0);
            return sum + equiv;
          }, 0) / activePackages.length
        : 39;

    const activeServices = services.filter((s) => s.isActive);
    const avgServicePrice =
      activeServices.length > 0
        ? activeServices.reduce((sum, s) => sum + Number(s.price || 0), 0) / activeServices.length
        : 150;

    // Recent 3-month average invoice revenue (for baseline projection)
    const last3 = revenueByMonth.slice(-3);
    const avgMonthlyInvoiceRevenue =
      last3.reduce((s, r) => s + r.total, 0) / Math.max(1, last3.length);
    const last3Svc = serviceRevenueByMonth.slice(-3);
    const avgMonthlyServiceRevenue =
      last3Svc.reduce((s, r) => s + r.total, 0) / Math.max(1, last3Svc.length);

    // Targets (stretch goals for the firm)
    const targetConversion = Math.min(0.6, Math.max(0.25, conversionRate + 0.2));
    const targetSubscribers = Math.max(
      activeSubs.length + 2,
      Math.ceil(activeClients.length * targetConversion)
    );
    const targetPackageMrr = targetSubscribers * avgPackageMonthly;
    const targetServiceOrdersPerMonth = Math.max(4, Math.ceil(activeClients.length * 0.15));
    const targetMonthlyServiceRevenue = targetServiceOrdersPerMonth * avgServicePrice;

    // Scenarios: how much upsell revenue in next 6 months if they sell more
    type Scenario = {
      id: "conservative" | "base" | "ambitious";
      newPackageClients: number;
      serviceOrdersPerMonth: number;
      packageRevenue6m: number;
      serviceRevenue6m: number;
      totalUpsell6m: number;
      totalWithBaseline6m: number;
    };

    const baseSvcOrders =
      avgMonthlyServiceRevenue > 0
        ? avgMonthlyServiceRevenue / Math.max(1, avgServicePrice)
        : Math.max(1, activeClients.length * 0.1);

    /**
     * Keep Conservative < On track < Ambitious even with tiny client bases
     * (e.g. 2 clients without a package used to round to the same integers).
     */
    const packageClientsByScenario = (() => {
      const pool = Math.max(0, clientsWithoutPackage);
      if (pool <= 0) {
        return { conservative: 0, base: 0, ambitious: 0 };
      }
      if (pool === 1) {
        return { conservative: 0, base: 1, ambitious: 1 };
      }
      if (pool === 2) {
        return { conservative: 1, base: 1, ambitious: 2 };
      }
      const conservative = Math.max(1, Math.floor(pool * 0.2));
      const ambitious = Math.min(pool, Math.max(conservative + 2, Math.ceil(pool * 0.6)));
      const base = Math.min(
        ambitious - 1,
        Math.max(conservative + 1, Math.round(pool * 0.35))
      );
      return { conservative, base, ambitious };
    })();

    const serviceOrdersByScenario = {
      conservative: Math.max(1, Math.round(baseSvcOrders * 1)),
      base: Math.max(2, Math.round(baseSvcOrders * 2)),
      ambitious: Math.max(3, Math.round(baseSvcOrders * 3.5)),
    };
    // Enforce strict step-up
    serviceOrdersByScenario.base = Math.max(
      serviceOrdersByScenario.conservative + 1,
      serviceOrdersByScenario.base
    );
    serviceOrdersByScenario.ambitious = Math.max(
      serviceOrdersByScenario.base + 1,
      serviceOrdersByScenario.ambitious
    );

    const buildScenario = (
      id: Scenario["id"],
      newPackageClients: number,
      serviceOrdersPerMonth: number
    ): Scenario => {
      const packageRevenue6m =
        packageMrr * 6 + newPackageClients * avgPackageMonthly * 6;
      const serviceRevenue6m = serviceOrdersPerMonth * avgServicePrice * 6;
      const totalUpsell6m =
        newPackageClients * avgPackageMonthly * 6 + serviceRevenue6m;
      const totalWithBaseline6m =
        avgMonthlyInvoiceRevenue * 6 + packageRevenue6m + serviceRevenue6m - packageMrr * 6;
      return {
        id,
        newPackageClients,
        serviceOrdersPerMonth,
        packageRevenue6m,
        serviceRevenue6m,
        totalUpsell6m,
        totalWithBaseline6m: Math.max(0, totalWithBaseline6m),
      };
    };

    const scenarios = {
      conservative: buildScenario(
        "conservative",
        packageClientsByScenario.conservative,
        serviceOrdersByScenario.conservative
      ),
      base: buildScenario(
        "base",
        packageClientsByScenario.base,
        serviceOrdersByScenario.base
      ),
      ambitious: buildScenario(
        "ambitious",
        packageClientsByScenario.ambitious,
        serviceOrdersByScenario.ambitious
      ),
    };

    const buildProjection = (scenario: Scenario) => {
      const rows: {
        month: string;
        baseline: number;
        packages: number;
        services: number;
        projected: number;
      }[] = [];
      for (let i = 1; i <= 6; i++) {
        const m = monthKey(addMonths(now, i));
        // Ramp new package MRR across the horizon; services assumed steady monthly
        const packagesAmt =
          packageMrr + (scenario.newPackageClients * avgPackageMonthly * i) / 6;
        const servicesAmt = scenario.serviceOrdersPerMonth * avgServicePrice;
        const baseline = avgMonthlyInvoiceRevenue;
        rows.push({
          month: m,
          baseline,
          packages: packagesAmt,
          services: servicesAmt,
          projected: baseline + packagesAmt + servicesAmt,
        });
      }
      return rows;
    };

    const projectionByMonth = buildProjection(scenarios.base);
    const projectionsByScenario = {
      conservative: buildProjection(scenarios.conservative),
      base: projectionByMonth,
      ambitious: buildProjection(scenarios.ambitious),
    };

    const revenueMix = [
      { name: "invoices", value: paidRevenue },
      { name: "packages", value: packageMrr * 12 }, // annualized for mix view
      { name: "services", value: serviceRevenue },
    ].filter((x) => x.value > 0);

    return {
      totals: {
        cases: allCases.length,
        invoices: allInvoices.length,
        clients: activeClients.length,
        unreadMessages: unread,
        paidRevenue,
        outstanding,
        packageMrr,
        serviceRevenue,
        activeSubscribers: activeSubs.length,
        clientsWithoutPackage,
        conversionRate,
      },
      casesByStatus,
      casesByType,
      invoicesByStatus,
      revenueByMonth,
      serviceRevenueByMonth,
      packageMix: Object.entries(packageMix).map(([name, count]) => ({ name, count })),
      revenueMix,
      targets: {
        targetConversion,
        targetSubscribers,
        targetPackageMrr,
        targetServiceOrdersPerMonth,
        targetMonthlyServiceRevenue,
        currentSubscribers: activeSubs.length,
        currentPackageMrr: packageMrr,
        currentMonthlyServiceRevenue: avgMonthlyServiceRevenue,
        avgPackageMonthly,
        avgServicePrice,
        progress: {
          subscribers:
            targetSubscribers > 0 ? Math.min(1, activeSubs.length / targetSubscribers) : 0,
          packageMrr: targetPackageMrr > 0 ? Math.min(1, packageMrr / targetPackageMrr) : 0,
          serviceRevenue:
            targetMonthlyServiceRevenue > 0
              ? Math.min(1, avgMonthlyServiceRevenue / targetMonthlyServiceRevenue)
              : 0,
        },
      },
      upsellForecast: {
        horizonMonths: 6,
        scenarios,
        projectionByMonth,
        projectionsByScenario,
        avgPackageMonthly,
        avgServicePrice,
      },
      catalog: {
        activePackages: activePackages.length,
        activeServices: activeServices.length,
      },
    };
  }),
});

