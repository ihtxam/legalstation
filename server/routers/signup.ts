import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  firmMembers,
  firmSubscriptions,
  firms,
  subscriptionPlans,
  users,
} from "../../drizzle/schema";
import { getDb, getFirmBySlug, getUserByEmail } from "../db";
import { hashPassword, slugifyFirmName } from "../auth/password";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { isSaas, isSingleTenant } from "../deployment";
import { isReservedSubdomain, firmLoginUrl, getAppBaseUrl } from "../tenant";
import { ENV } from "../_core/env";

const TRIAL_DAYS = 15;

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugifyFirmName(base);
  if (!slug || slug.length < 2) slug = `firm-${nanoid(6).toLowerCase()}`;
  if (isReservedSubdomain(slug)) slug = `${slug}-law`;

  let candidate = slug;
  for (let i = 0; i < 20; i++) {
    const existing = await getFirmBySlug(candidate);
    if (!existing) return candidate;
    candidate = `${slug}-${i + 2}`;
  }
  return `${slug}-${nanoid(4).toLowerCase()}`;
}

export const signupRouter = router({
  /** Public info for homepage (trial length, base domain, modes). */
  info: publicProcedure.query(async () => {
    return {
      trialDays: TRIAL_DAYS,
      saasEnabled: isSaas() && !isSingleTenant(),
      appBaseDomain: ENV.appBaseDomain || null,
      appUrl: ENV.appUrl || null,
      customDomainIp: process.env.APP_PUBLIC_IP || "46.224.188.217",
    };
  }),

  /**
   * Self-serve firm signup: creates admin user + firm workspace + 15-day trial.
   * Logs the user in and returns URLs for onboarding.
   */
  createFirmTrial: publicProcedure
    .input(
      z.object({
        firmName: z.string().trim().min(2).max(255),
        contactName: z.string().trim().min(1).max(200),
        email: z.string().trim().toLowerCase().pipe(z.email()),
        password: z.string().min(8).max(200),
        phone: z.string().trim().max(50).optional(),
        slug: z.string().trim().max(80).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isSaas() || isSingleTenant()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Self-serve signup is only available on LexFlow Cloud. Contact us for on-premise.",
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const email = input.email.trim().toLowerCase();
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Sign in instead.",
        });
      }

      const slug = await uniqueSlug(input.slug || input.firmName);

      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(asc(subscriptionPlans.sortOrder))
        .limit(1);

      if (!plan) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No subscription plan is configured. Please contact LexFlow support.",
        });
      }

      const openId = `password-trial-${nanoid(12)}`;
      await db.insert(users).values({
        openId,
        email,
        name: input.contactName.trim(),
        role: "user",
        loginMethod: "password",
        passwordHash: hashPassword(input.password),
        mustChangePassword: false,
        lastSignedIn: new Date(),
      });

      const user = await getUserByEmail(email);
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
      }

      const [firmInsert] = await db.insert(firms).values({
        name: input.firmName.trim(),
        slug,
        email,
        phone: input.phone?.trim() || null,
        subdomainStatus: "active",
        onboardingStep: 1,
      });
      const firmId = Number((firmInsert as { insertId?: number }).insertId);
      if (!firmId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create firm" });
      }

      await db.insert(firmMembers).values({
        firmId,
        userId: user.id,
        firmRole: "admin",
        title: "Owner",
      });

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      await db.insert(firmSubscriptions).values({
        firmId,
        planId: plan.id,
        billingCycle: "monthly",
        status: "trialing",
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || user.openId,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const loginUrl = firmLoginUrl(slug, ctx.req);
      const workspaceUrl = `${getAppBaseUrl(ctx.req)}/firm-onboarding`;

      return {
        firmId,
        slug,
        loginUrl,
        workspaceUrl,
        trialDays: TRIAL_DAYS,
        trialEndsAt,
        planName: plan.name,
        redirectTo: "/firm-onboarding",
      };
    }),
});
