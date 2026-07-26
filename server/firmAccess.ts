import { eq } from "drizzle-orm";
import { firmSubscriptions, subscriptionPlans } from "../drizzle/schema";
import { getDb, getFirmMemberByUserId } from "./db";

export type FirmPlatformAccess = {
  firmId: number;
  firmRole: string;
  locked: boolean;
  reason: "trial_expired" | "suspended" | "cancelled" | "past_due" | null;
  status: string | null;
  trialDaysLeft: number;
  trialExpired: boolean;
  trialActive: boolean;
  planId: number | null;
  planName: string | null;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  trialEndsAt: Date | null;
};

/** Paths allowed while a firm is locked out of the platform. */
export const LOCKED_FIRM_ALLOWED_PATHS = new Set([
  "auth.me",
  "auth.logout",
  "auth.setupTotp",
  "auth.enableTotp",
  "auth.disableTotp",
  "firm.myFirm",
  "firm.account",
  "firm.listPlans",
  "firm.createPlanCheckout",
  "firm.activatePlan",
  "supportTickets.quota",
  "supportTickets.listMine",
  "supportTickets.get",
  "supportTickets.create",
  "supportTickets.reply",
  "supportTickets.unreadCount",
  "announcements.active",
  "announcements.dismiss",
]);

export async function getFirmPlatformAccess(userId: number): Promise<FirmPlatformAccess | null> {
  const member = await getFirmMemberByUserId(userId);
  if (!member) return null;

  const db = await getDb();
  if (!db) {
    return {
      firmId: member.firmId,
      firmRole: member.firmRole,
      locked: false,
      reason: null,
      status: null,
      trialDaysLeft: 0,
      trialExpired: false,
      trialActive: false,
      planId: null,
      planName: null,
      monthlyPrice: null,
      yearlyPrice: null,
      trialEndsAt: null,
    };
  }

  const [row] = await db
    .select({
      status: firmSubscriptions.status,
      trialEndsAt: firmSubscriptions.trialEndsAt,
      planId: firmSubscriptions.planId,
      planName: subscriptionPlans.name,
      monthlyPrice: subscriptionPlans.monthlyPrice,
      yearlyPrice: subscriptionPlans.yearlyPrice,
    })
    .from(firmSubscriptions)
    .leftJoin(subscriptionPlans, eq(firmSubscriptions.planId, subscriptionPlans.id))
    .where(eq(firmSubscriptions.firmId, member.firmId))
    .limit(1);

  if (!row) {
    return {
      firmId: member.firmId,
      firmRole: member.firmRole,
      locked: false,
      reason: null,
      status: null,
      trialDaysLeft: 0,
      trialExpired: false,
      trialActive: false,
      planId: null,
      planName: null,
      monthlyPrice: null,
      yearlyPrice: null,
      trialEndsAt: null,
    };
  }

  const now = Date.now();
  const trialEndsAt = row.trialEndsAt ?? null;
  const trialActive =
    row.status === "trialing" && !!trialEndsAt && trialEndsAt.getTime() > now;
  const trialExpired =
    row.status === "trialing" && !!trialEndsAt && trialEndsAt.getTime() <= now;
  const trialDaysLeft =
    trialEndsAt && trialEndsAt.getTime() > now
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : 0;

  let locked = false;
  let reason: FirmPlatformAccess["reason"] = null;
  if (row.status === "suspended") {
    locked = true;
    reason = "suspended";
  } else if (row.status === "cancelled") {
    locked = true;
    reason = "cancelled";
  } else if (row.status === "past_due") {
    locked = true;
    reason = "past_due";
  } else if (trialExpired) {
    locked = true;
    reason = "trial_expired";
  }

  return {
    firmId: member.firmId,
    firmRole: member.firmRole,
    locked,
    reason,
    status: row.status,
    trialDaysLeft,
    trialExpired,
    trialActive,
    planId: row.planId,
    planName: row.planName,
    monthlyPrice: row.monthlyPrice != null ? String(row.monthlyPrice) : null,
    yearlyPrice: row.yearlyPrice != null ? String(row.yearlyPrice) : null,
    trialEndsAt,
  };
}

export async function activateFirmPlan(opts: {
  firmId: number;
  planId: number;
  billingCycle: "monthly" | "yearly";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, opts.planId))
    .limit(1);
  if (!plan || !plan.isActive) throw new Error("Plan not available");

  const now = new Date();
  const periodMs =
    opts.billingCycle === "yearly"
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
  const currentPeriodEnd = new Date(now.getTime() + periodMs);

  await db
    .update(firmSubscriptions)
    .set({
      planId: opts.planId,
      billingCycle: opts.billingCycle,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd,
      trialEndsAt: null,
      cancelledAt: null,
    })
    .where(eq(firmSubscriptions.firmId, opts.firmId));

  return { plan, currentPeriodEnd };
}
