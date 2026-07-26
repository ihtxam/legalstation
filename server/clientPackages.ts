import { and, eq, gte, lte } from "drizzle-orm";
import {
  cases,
  caseAssignments,
  clientSubscriptions,
  firmClientPackages,
  type ClientSubscription,
  type FirmClientPackage,
} from "../drizzle/schema";
import { getDb } from "./db";

export function periodEndFrom(start: Date, interval: "monthly" | "yearly") {
  const end = new Date(start);
  if (interval === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export async function getActiveClientSubscription(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      subscription: clientSubscriptions,
      package: firmClientPackages,
    })
    .from(clientSubscriptions)
    .innerJoin(firmClientPackages, eq(clientSubscriptions.packageId, firmClientPackages.id))
    .where(
      and(eq(clientSubscriptions.clientId, clientId), eq(clientSubscriptions.status, "active"))
    )
    .limit(1);
  return row || null;
}

/** Count cases opened by this client in the current subscription period. */
export async function countCasesInPeriod(opts: {
  clientId: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .innerJoin(caseAssignments, eq(caseAssignments.caseId, cases.id))
    .where(
      and(
        eq(caseAssignments.clientId, opts.clientId),
        eq(caseAssignments.assignmentType, "client"),
        gte(cases.openedAt, opts.periodStart),
        lte(cases.openedAt, opts.periodEnd)
      )
    );
  return rows.length;
}

export async function getQuotaStatus(clientId: number) {
  const active = await getActiveClientSubscription(clientId);
  if (!active) {
    return {
      hasSubscription: false as const,
      subscription: null,
      package: null,
      casesUsed: 0,
      casesAllowed: 0,
      remaining: 0,
      canCreateCase: false,
    };
  }
  // Roll period forward if expired but still marked active
  let sub = active.subscription;
  let pkg = active.package;
  const now = new Date();
  if (sub.currentPeriodEnd < now) {
    const db = await getDb();
    if (db) {
      const start = sub.currentPeriodEnd;
      const end = periodEndFrom(start, sub.billingInterval);
      await db
        .update(clientSubscriptions)
        .set({ currentPeriodStart: start, currentPeriodEnd: end })
        .where(eq(clientSubscriptions.id, sub.id));
      sub = { ...sub, currentPeriodStart: start, currentPeriodEnd: end };
    }
  }

  const casesUsed = await countCasesInPeriod({
    clientId,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
  });
  const casesAllowed = pkg.casesPerPeriod;
  const remaining = Math.max(0, casesAllowed - casesUsed);
  return {
    hasSubscription: true as const,
    subscription: sub,
    package: pkg,
    casesUsed,
    casesAllowed,
    remaining,
    canCreateCase: remaining > 0,
  };
}

export function parseAllowedCaseTypes(pkg: FirmClientPackage): string[] | null {
  if (!pkg.allowedCaseTypes) return null;
  try {
    const parsed = JSON.parse(pkg.allowedCaseTypes);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function publicPackage(pkg: FirmClientPackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    currency: pkg.currency,
    billingInterval: pkg.billingInterval,
    casesPerPeriod: pkg.casesPerPeriod,
    allowedCaseTypes: parseAllowedCaseTypes(pkg),
    features: (() => {
      try {
        return pkg.features ? JSON.parse(pkg.features) : [];
      } catch {
        return [];
      }
    })(),
    sortOrder: pkg.sortOrder,
  };
}

export type QuotaStatus = Awaited<ReturnType<typeof getQuotaStatus>>;
export type { ClientSubscription, FirmClientPackage };
