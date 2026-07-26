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

export type ClientBillingInterval = "monthly" | "biannual" | "yearly";

export function periodEndFrom(start: Date, interval: ClientBillingInterval) {
  const end = new Date(start);
  if (interval === "yearly") end.setFullYear(end.getFullYear() + 1);
  else if (interval === "biannual") end.setMonth(end.getMonth() + 6);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

/** Minimum commitment window (product default: 12 months). */
export function commitmentEndFrom(start: Date, months = 12): Date {
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end;
}

export function priceForInterval(
  pkg: {
    monthlyPrice?: string | null;
    biannualPrice?: string | null;
    yearlyPrice?: string | null;
    price: string;
    billingInterval: string;
  },
  interval: ClientBillingInterval
): string | null {
  if (interval === "monthly") {
    const v = pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : null);
    if (v != null && Number(v) > 0) return String(v);
    return null;
  }
  if (interval === "biannual") {
    const v = pkg.biannualPrice;
    if (v != null && Number(v) > 0) return String(v);
    return null;
  }
  const v = pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : null);
  if (v != null && Number(v) > 0) return String(v);
  return null;
}

export function availableBillingIntervals(pkg: {
  monthlyPrice?: string | null;
  biannualPrice?: string | null;
  yearlyPrice?: string | null;
  price: string;
  billingInterval: string;
}): ClientBillingInterval[] {
  const out: ClientBillingInterval[] = [];
  if (priceForInterval(pkg, "monthly")) out.push("monthly");
  if (priceForInterval(pkg, "biannual")) out.push("biannual");
  if (priceForInterval(pkg, "yearly")) out.push("yearly");
  if (out.length === 0) {
    // Legacy single-price packages with zero/missing multi-price columns
    if (Number(pkg.price) > 0) {
      out.push(pkg.billingInterval === "yearly" ? "yearly" : "monthly");
    }
  }
  return out;
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

/** Count cases opened by this client in the commitment-year window. */
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

function commitmentStartFrom(endsAt: Date, months: number) {
  const start = new Date(endsAt);
  start.setMonth(start.getMonth() - months);
  return start;
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

  let sub = active.subscription;
  let pkg = active.package;
  const now = new Date();
  const db = await getDb();
  const months = pkg.minCommitmentMonths ?? 12;
  const interval = (sub.billingInterval || "monthly") as ClientBillingInterval;

  // Roll billing period forward when due (payment cadence only).
  if (sub.currentPeriodEnd < now && db) {
    let start = sub.currentPeriodEnd;
    let end = periodEndFrom(start, interval);
    while (end < now) {
      start = end;
      end = periodEndFrom(start, interval);
    }
    await db
      .update(clientSubscriptions)
      .set({ currentPeriodStart: start, currentPeriodEnd: end })
      .where(eq(clientSubscriptions.id, sub.id));
    sub = { ...sub, currentPeriodStart: start, currentPeriodEnd: end };
  }

  // Entitlement year = commitment window (independent of monthly/biannual/yearly billing).
  let commitmentEndsAt =
    sub.commitmentEndsAt ?? commitmentEndFrom(sub.currentPeriodStart, months);
  if (commitmentEndsAt < now) {
    let end = commitmentEndsAt;
    while (end < now) {
      end = commitmentEndFrom(end, months);
    }
    if (db) {
      await db
        .update(clientSubscriptions)
        .set({ commitmentEndsAt: end })
        .where(eq(clientSubscriptions.id, sub.id));
    }
    commitmentEndsAt = end;
    sub = { ...sub, commitmentEndsAt };
  } else if (!sub.commitmentEndsAt && db) {
    await db
      .update(clientSubscriptions)
      .set({ commitmentEndsAt })
      .where(eq(clientSubscriptions.id, sub.id));
    sub = { ...sub, commitmentEndsAt };
  }

  const entitlementStart = commitmentStartFrom(commitmentEndsAt, months);
  const casesUsed = await countCasesInPeriod({
    clientId,
    periodStart: entitlementStart,
    periodEnd: commitmentEndsAt,
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

export function parseFeatures(pkg: FirmClientPackage): string[] {
  try {
    return pkg.features ? JSON.parse(pkg.features) : [];
  } catch {
    return [];
  }
}

export function publicPackage(pkg: FirmClientPackage) {
  const monthlyPrice =
    pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : null);
  const biannualPrice = pkg.biannualPrice ?? null;
  const yearlyPrice =
    pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : null);
  const intervals = availableBillingIntervals({
    monthlyPrice,
    biannualPrice,
    yearlyPrice,
    price: pkg.price,
    billingInterval: pkg.billingInterval,
  });
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: pkg.price,
    monthlyPrice: monthlyPrice != null ? String(monthlyPrice) : null,
    biannualPrice: biannualPrice != null ? String(biannualPrice) : null,
    yearlyPrice: yearlyPrice != null ? String(yearlyPrice) : null,
    currency: pkg.currency,
    billingInterval: pkg.billingInterval,
    availableIntervals: intervals,
    minCommitmentMonths: pkg.minCommitmentMonths ?? 12,
    /** Annual entitlements (same for every billing cadence). */
    casesPerYear: pkg.casesPerPeriod,
    consultationHoursPerYear: Number(pkg.consultationHoursPerPeriod || 0),
    /** @deprecated use casesPerYear */
    casesPerPeriod: pkg.casesPerPeriod,
    /** @deprecated use consultationHoursPerYear */
    consultationHoursPerPeriod: Number(pkg.consultationHoursPerPeriod || 0),
    includedFixedHours: Number(pkg.includedFixedHours || 0),
    highlightLabel: pkg.highlightLabel,
    allowedCaseTypes: parseAllowedCaseTypes(pkg),
    features: parseFeatures(pkg),
    sortOrder: pkg.sortOrder,
  };
}

export type QuotaStatus = Awaited<ReturnType<typeof getQuotaStatus>>;
export type { ClientSubscription, FirmClientPackage };
