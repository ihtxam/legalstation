import { z } from "zod";
import { protectedProcedure, router, superadminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getUserByEmail } from "../db";
import {
  firms,
  firmSubscriptions,
  subscriptionPlans,
  users,
  invitations,
  firmMembers,
  superadminAuditLog,
  agencySettings,
  platformAnnouncements,
  announcementDismissals,
} from "../../drizzle/schema";
import { eq, and, desc, asc, ne } from "drizzle-orm";
import { ENV } from "../_core/env";
import {
  generateTemporaryPassword,
  hashPassword,
  slugifyFirmName,
} from "../auth/password";
import { isReservedSubdomain, firmLoginUrl, getAppBaseUrl } from "../tenant";
import { sendFirmCredentialsEmail } from "../email";
import { nanoid } from "nanoid";

async function upsertAgencySetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  await db
    .insert(agencySettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

async function getAgencySettingsMap(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(agencySettings);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

async function uniqueFirmSlug(base: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  let slug = base || `firm-${nanoid(6)}`;
  if (isReservedSubdomain(slug)) slug = `${slug}-law`;
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? slug : `${slug}-${nanoid(4)}`;
    const existing = await db.select().from(firms).where(eq(firms.slug, candidate)).limit(1);
    if (!existing[0]) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

async function audit(superadminId: number, action: string, targetType: string, targetId?: number, details?: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.insert(superadminAuditLog).values({
    superadminId,
    action,
    targetType,
    targetId,
    details: details ? JSON.stringify(details) : null,
  });
}

async function provisionFirmOwner(opts: {
  firmId: number;
  firmName: string;
  email: string;
  ownerName?: string;
  sendCredentials: boolean;
  reqOrigin?: string;
  invitedByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const email = opts.email.toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  let user = await getUserByEmail(email);

  if (!user) {
    const openId = `password-owner-${email}-${nanoid(8)}`;
    await db.insert(users).values({
      openId,
      email,
      name: opts.ownerName || opts.firmName,
      role: "user",
      loginMethod: "password",
      passwordHash: hashPassword(temporaryPassword),
      mustChangePassword: true,
    });
    user = await getUserByEmail(email);
  } else if (!user.passwordHash) {
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(temporaryPassword),
        mustChangePassword: true,
        loginMethod: "password",
      })
      .where(eq(users.id, user.id));
  } else {
    // Reset temp password when resending credentials
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(temporaryPassword),
        mustChangePassword: true,
      })
      .where(eq(users.id, user.id));
  }

  if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create owner" });

  const [member] = await db
    .select()
    .from(firmMembers)
    .where(and(eq(firmMembers.firmId, opts.firmId), eq(firmMembers.userId, user.id)))
    .limit(1);

  if (!member) {
    await db.insert(firmMembers).values({
      firmId: opts.firmId,
      userId: user.id,
      firmRole: "admin",
      title: "Owner",
    });
  } else if (member.firmRole !== "admin") {
    await db.update(firmMembers).set({ firmRole: "admin" }).where(eq(firmMembers.id, member.id));
  }

  const firm = (await db.select().from(firms).where(eq(firms.id, opts.firmId)).limit(1))[0];
  const loginUrl = firm
    ? firmLoginUrl(firm.slug)
    : `${opts.reqOrigin || getAppBaseUrl()}/login`;

  if (opts.sendCredentials) {
    await sendFirmCredentialsEmail({
      email,
      firmName: opts.firmName,
      ownerName: opts.ownerName || user.name || "there",
      loginUrl,
      temporaryPassword,
    }).catch((err) => {
      console.error("[Email] Failed to send credentials:", err.message);
    });
    await db.update(firms).set({ credentialsSentAt: new Date() }).where(eq(firms.id, opts.firmId));
  }

  // Also keep an invite token for magic-link fallback
  const inviteToken = nanoid(64);
  await db.insert(invitations).values({
    invitedByUserId: opts.invitedByUserId,
    firmId: opts.firmId,
    email,
    role: "lawyer",
    token: inviteToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    userId: user.id,
    temporaryPassword: opts.sendCredentials ? undefined : temporaryPassword,
    loginUrl,
    inviteToken,
  };
}

export const superadminRouter = router({
  listFirms: superadminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allFirms = await db.select().from(firms).orderBy(desc(firms.createdAt));

    const enriched = await Promise.all(
      allFirms.map(async (firm) => {
        const sub = await db
          .select()
          .from(firmSubscriptions)
          .where(eq(firmSubscriptions.firmId, firm.id))
          .limit(1);
        return { ...firm, subscription: sub[0] || null };
      })
    );

    return enriched;
  }),

  createFirm: superadminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        ownerName: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        vatNumber: z.string().optional(),
        slug: z.string().max(50).optional(),
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
        sendCredentials: z.boolean().default(true),
        defaultCurrency: z.string().length(3).default("CHF"),
        defaultVatRate: z.number().min(0).max(100).default(8.1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.planId))
        .limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Always sanitize — manual slug fields may contain "&", spaces, etc.
      const baseSlug = slugifyFirmName(input.slug || input.name);
      if (!baseSlug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not derive a valid subdomain from the firm name" });
      }
      if (isReservedSubdomain(baseSlug)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This subdomain is reserved" });
      }
      const slug = await uniqueFirmSlug(baseSlug);

      const result = await db.insert(firms).values({
        name: input.name,
        slug,
        email: input.email,
        address: input.address,
        phone: input.phone,
        vatNumber: input.vatNumber,
        defaultCurrency: input.defaultCurrency.toUpperCase(),
        defaultVatRate: input.defaultVatRate.toFixed(2),
        subdomainStatus: "pending",
        onboardingStep: 0,
      });

      const firmId = result[0].insertId as number;

      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + (input.billingCycle === "yearly" ? 12 : 1));

      await db.insert(firmSubscriptions).values({
        firmId,
        planId: input.planId,
        billingCycle: input.billingCycle,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      const owner = await provisionFirmOwner({
        firmId,
        firmName: input.name,
        email: input.email,
        ownerName: input.ownerName,
        sendCredentials: input.sendCredentials,
        invitedByUserId: ctx.user.id,
        reqOrigin: getAppBaseUrl(ctx.req),
      });

      await audit(ctx.user.id, "create_firm", "firm", firmId, {
        slug,
        email: input.email,
        sendCredentials: input.sendCredentials,
      });

      return {
        firmId,
        slug,
        loginUrl: owner.loginUrl,
        inviteToken: owner.inviteToken,
        temporaryPassword: owner.temporaryPassword,
        credentialsSent: input.sendCredentials,
      };
    }),

  sendFirmCredentials: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [firm] = await db.select().from(firms).where(eq(firms.id, input.firmId)).limit(1);
      if (!firm) throw new TRPCError({ code: "NOT_FOUND" });
      if (!firm.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Firm has no email" });

      const owner = await provisionFirmOwner({
        firmId: firm.id,
        firmName: firm.name,
        email: firm.email,
        sendCredentials: true,
        invitedByUserId: ctx.user.id,
      });

      await audit(ctx.user.id, "send_credentials", "firm", firm.id, { email: firm.email });

      return { success: true, loginUrl: owner.loginUrl };
    }),

  setSubdomainStatus: superadminProcedure
    .input(
      z.object({
        firmId: z.number(),
        status: z.enum(["none", "pending", "active", "rejected"]),
        customDomain: z.string().max(255).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(firms)
        .set({
          subdomainStatus: input.status,
          customDomain: input.customDomain === undefined ? undefined : input.customDomain,
        })
        .where(eq(firms.id, input.firmId));

      await audit(ctx.user.id, "set_subdomain_status", "firm", input.firmId, {
        status: input.status,
        customDomain: input.customDomain,
      });

      return { success: true };
    }),

  getFirmDetails: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const firm = await db.select().from(firms).where(eq(firms.id, input.firmId)).limit(1);
      if (!firm[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const sub = await db
        .select()
        .from(firmSubscriptions)
        .where(eq(firmSubscriptions.firmId, input.firmId))
        .limit(1);

      const plan = sub[0]
        ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub[0].planId)).limit(1)
        : null;

      return { firm: firm[0], subscription: sub[0], plan: plan?.[0] || null };
    }),

  updateFirmSubscription: superadminProcedure
    .input(
      z.object({
        firmId: z.number(),
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const sub = await db
        .select()
        .from(firmSubscriptions)
        .where(eq(firmSubscriptions.firmId, input.firmId))
        .limit(1);

      if (!sub[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + (input.billingCycle === "yearly" ? 12 : 1));

      await db
        .update(firmSubscriptions)
        .set({
          planId: input.planId,
          billingCycle: input.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: "active",
        })
        .where(eq(firmSubscriptions.id, sub[0].id));

      await audit(ctx.user.id, "update_subscription", "firm", input.firmId, input);
      return { success: true };
    }),

  suspendFirm: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(firmSubscriptions)
        .set({ status: "suspended" })
        .where(eq(firmSubscriptions.firmId, input.firmId));

      await audit(ctx.user.id, "suspend_firm", "firm", input.firmId);
      return { success: true };
    }),

  reactivateFirm: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(firmSubscriptions)
        .set({ status: "active", cancelledAt: null })
        .where(eq(firmSubscriptions.firmId, input.firmId));

      await audit(ctx.user.id, "reactivate_firm", "firm", input.firmId);
      return { success: true };
    }),

  listPlans: superadminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder));
  }),

  createPlan: superadminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        maxUsers: z.number().int().positive(),
        monthlyPrice: z.number().nonnegative(),
        yearlyPrice: z.number().nonnegative(),
        features: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(subscriptionPlans).values({
        name: input.name,
        description: input.description,
        maxUsers: input.maxUsers,
        monthlyPrice: input.monthlyPrice.toFixed(2),
        yearlyPrice: input.yearlyPrice.toFixed(2),
        features: JSON.stringify(input.features || []),
      });

      await audit(ctx.user.id, "create_plan", "plan", result[0].insertId as number, input);
      return { planId: result[0].insertId as number };
    }),

  updatePlan: superadminProcedure
    .input(
      z.object({
        planId: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        maxUsers: z.number().int().positive().optional(),
        monthlyPrice: z.number().nonnegative().optional(),
        yearlyPrice: z.number().nonnegative().optional(),
        features: z.array(z.string()).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.planId))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.maxUsers !== undefined) updates.maxUsers = input.maxUsers;
      if (input.monthlyPrice !== undefined) updates.monthlyPrice = input.monthlyPrice.toFixed(2);
      if (input.yearlyPrice !== undefined) updates.yearlyPrice = input.yearlyPrice.toFixed(2);
      if (input.features !== undefined) updates.features = JSON.stringify(input.features);
      if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, input.planId));
      await audit(ctx.user.id, "update_plan", "plan", input.planId, updates);
      return { success: true };
    }),

  /** Superadmin opens a firm workspace as that firm's admin user. */
  impersonateFirmAdmin: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [firm] = await db.select().from(firms).where(eq(firms.id, input.firmId)).limit(1);
      if (!firm) throw new TRPCError({ code: "NOT_FOUND", message: "Firm not found" });

      const adminMembers = await db
        .select()
        .from(firmMembers)
        .where(and(eq(firmMembers.firmId, input.firmId), eq(firmMembers.firmRole, "admin")));

      let targetUser: (typeof users.$inferSelect) | null = null;
      for (const member of adminMembers) {
        const [u] = await db.select().from(users).where(eq(users.id, member.userId)).limit(1);
        if (u && u.role !== "superadmin") {
          targetUser = u;
          break;
        }
      }

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No firm admin user found for this firm",
        });
      }

      const { startImpersonationSession, getSessionCookieToken } = await import("../impersonation");

      await startImpersonationSession(ctx.req, ctx.res, {
        targetUser,
        currentSessionToken: getSessionCookieToken(ctx.req),
      });

      await audit(ctx.user.id, "impersonate_firm_admin", "firm", firm.id, {
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
      });

      const onboardingDone = Boolean(firm.onboardingCompletedAt);
      return {
        success: true as const,
        redirectTo: onboardingDone ? "/dashboard" : "/firm-onboarding",
        firmName: firm.name,
        adminEmail: targetUser.email,
        adminName: targetUser.name,
      };
    }),

  /**
   * First-time bootstrap only with SUPERADMIN_BOOTSTRAP_SECRET.
   * Never available as a click-to-elevate from firm/client dashboards.
   */
  setupSuperadmin: protectedProcedure
    .input(z.object({ bootstrapSecret: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ENV.superadminBootstrapSecret) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Superadmin bootstrap is disabled. Set SUPERADMIN_BOOTSTRAP_SECRET or use /platform/login bootstrap.",
        });
      }
      if (input.bootstrapSecret !== ENV.superadminBootstrapSecret) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid bootstrap secret" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existingSuperadmin = await db
        .select()
        .from(users)
        .where(eq(users.role, "superadmin"))
        .limit(1);

      if (existingSuperadmin[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "A superadmin already exists. Contact the platform administrator.",
        });
      }

      await db.update(users).set({ role: "superadmin" }).where(eq(users.id, ctx.user.id));
      return { success: true, message: "You have been designated as superadmin." };
    }),

  getFirmDetail: superadminProcedure
    .input(z.object({ firmId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const firm = await db.select().from(firms).where(eq(firms.id, input.firmId)).limit(1);
      if (!firm[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const sub = await db
        .select()
        .from(firmSubscriptions)
        .where(eq(firmSubscriptions.firmId, input.firmId))
        .limit(1);

      const plan = sub[0]
        ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub[0].planId)).limit(1)
        : null;

      const { invoices: invoicesTable } = await import("../../drizzle/schema");
      const billingHistory = await db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.firmId, input.firmId))
        .orderBy(desc(invoicesTable.createdAt))
        .limit(20);

      const { cases: casesTable, clients: clientsTable, documents: documentsTable, messages: messagesTable } =
        await import("../../drizzle/schema");

      const caseCount = await db.select().from(casesTable).where(eq(casesTable.firmId, input.firmId));
      const clientCount = await db.select().from(clientsTable).where(eq(clientsTable.firmId, input.firmId));
      const documentCount = await db.select().from(documentsTable).where(eq(documentsTable.firmId, input.firmId));
      const messageCount = await db.select().from(messagesTable).where(eq(messagesTable.firmId, input.firmId));

      const members = await db.select().from(firmMembers).where(eq(firmMembers.firmId, input.firmId));

      return {
        firm: firm[0],
        subscription: sub[0],
        plan: plan?.[0],
        billingHistory,
        usageMetrics: {
          totalCases: caseCount.length,
          totalClients: clientCount.length,
          totalDocuments: documentCount.length,
          totalMessages: messageCount.length,
          totalMembers: members.length,
        },
        members,
        loginUrl: firmLoginUrl(firm[0].slug),
        recentActivity: [] as any[],
      };
    }),

  getStats: superadminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allFirms = await db.select().from(firms);

    const activeFirmsResult = await db
      .select()
      .from(firms)
      .innerJoin(firmSubscriptions, eq(firms.id, firmSubscriptions.firmId))
      .where(eq(firmSubscriptions.status, "active"));

    const allUsers = await db.select().from(users);
    const activeSubscriptions = await db
      .select()
      .from(firmSubscriptions)
      .where(eq(firmSubscriptions.status, "active"));

    let totalRevenue = 0;
    for (const sub of activeSubscriptions) {
      const plan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, sub.planId))
        .limit(1);

      if (plan[0]) {
        const price =
          sub.billingCycle === "yearly"
            ? parseFloat(plan[0].yearlyPrice as string)
            : parseFloat(plan[0].monthlyPrice as string);
        totalRevenue += price;
      }
    }

    return {
      totalFirms: allFirms.length,
      activeFirms: activeFirmsResult.length,
      totalUsers: allUsers.length,
      totalRevenue,
      activeSubscriptions: activeSubscriptions.length,
    };
  }),

  /** Existing superadmins only may promote another user. */
  setupSuperadminByEmail: superadminProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).optional(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const email = input.email.toLowerCase();
      const targetUser = await getUserByEmail(email);
      const tempPassword = input.password || generateTemporaryPassword();

      if (!targetUser) {
        const openId = `password-superadmin-${email}-${nanoid(6)}`;
        await db.insert(users).values({
          openId,
          email,
          name: input.name || "Platform Admin",
          role: "superadmin",
          loginMethod: "password",
          passwordHash: hashPassword(tempPassword),
          mustChangePassword: !input.password,
        });
        await audit(ctx.user.id, "create_superadmin", "user", undefined, { email });
        return {
          success: true,
          message: `Superadmin created for ${email}.`,
          temporaryPassword: input.password ? undefined : tempPassword,
          loginUrl: `${getAppBaseUrl(ctx.req)}/platform/login`,
        };
      }

      await db
        .update(users)
        .set({
          role: "superadmin",
          passwordHash: hashPassword(tempPassword),
          mustChangePassword: !input.password,
          loginMethod: "password",
        })
        .where(eq(users.id, targetUser.id));

      await audit(ctx.user.id, "promote_superadmin", "user", targetUser.id, { email });
      return {
        success: true,
        message: `${email} has been promoted to superadmin.`,
        temporaryPassword: input.password ? undefined : tempPassword,
        loginUrl: `${getAppBaseUrl(ctx.req)}/platform/login`,
      };
    }),

  demoteSuperadmin: superadminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot demote yourself" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const remaining = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "superadmin"), ne(users.id, input.userId)));
      if (remaining.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one superadmin must remain",
        });
      }

      await db.update(users).set({ role: "user" }).where(eq(users.id, input.userId));
      await audit(ctx.user.id, "demote_superadmin", "user", input.userId);
      return { success: true };
    }),

  updateFirm: superadminProcedure
    .input(
      z.object({
        firmId: z.number(),
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        address: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        vatNumber: z.string().optional().nullable(),
        defaultCurrency: z.string().length(3).optional(),
        defaultVatRate: z.number().min(0).max(100).optional(),
        customDomain: z.string().max(255).optional().nullable(),
        slug: z.string().max(50).optional(),
        /** Storage quota in GB (e.g. 2, 10, 50). */
        storageQuotaGb: z.number().min(1).max(1024).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [firm] = await db.select().from(firms).where(eq(firms.id, input.firmId)).limit(1);
      if (!firm) throw new TRPCError({ code: "NOT_FOUND" });

      let nextSlug: string | undefined;
      if (input.slug !== undefined) {
        nextSlug = slugifyFirmName(input.slug || input.name || firm.name);
        if (!nextSlug || nextSlug.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subdomain must use letters, numbers, and hyphens only",
          });
        }
        if (nextSlug !== firm.slug) {
          if (isReservedSubdomain(nextSlug)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Subdomain reserved" });
          }
          const clash = await db.select().from(firms).where(eq(firms.slug, nextSlug)).limit(1);
          if (clash[0]) throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" });
        }
      }

      const { gbToBytes } = await import("../firmStorage");
      await db
        .update(firms)
        .set({
          name: input.name,
          email: input.email,
          address: input.address === undefined ? undefined : input.address,
          phone: input.phone === undefined ? undefined : input.phone,
          vatNumber: input.vatNumber === undefined ? undefined : input.vatNumber,
          defaultCurrency: input.defaultCurrency?.toUpperCase(),
          defaultVatRate:
            input.defaultVatRate != null ? input.defaultVatRate.toFixed(2) : undefined,
          customDomain: input.customDomain === undefined ? undefined : input.customDomain,
          slug: nextSlug,
          storageQuotaBytes:
            input.storageQuotaGb != null ? gbToBytes(input.storageQuotaGb) : undefined,
        })
        .where(eq(firms.id, input.firmId));

      await audit(ctx.user.id, "update_firm", "firm", input.firmId, {
        ...input,
        slug: nextSlug ?? input.slug,
      });
      return { success: true };
    }),

  listUsers: superadminProcedure
    .input(
      z
        .object({
          role: z.enum(["user", "admin", "superadmin"]).optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(input?.limit ?? 100);
      if (input?.role) rows = rows.filter((u) => u.role === input.role);
      if (input?.search) {
        const q = input.search.toLowerCase();
        rows = rows.filter(
          (u) =>
            (u.email || "").toLowerCase().includes(q) ||
            (u.name || "").toLowerCase().includes(q)
        );
      }
      return rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        loginMethod: u.loginMethod,
        preferredLocale: u.preferredLocale,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),

  listAuditLog: superadminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(superadminAuditLog)
        .orderBy(desc(superadminAuditLog.createdAt))
        .limit(input?.limit ?? 50);
    }),

  getSystemStatus: superadminProcedure.query(async () => {
    const settings = await getAgencySettingsMap();
    return {
      deploymentMode: ENV.deploymentMode,
      singleTenant: ENV.singleTenant,
      dataResidency: ENV.dataResidency,
      appUrl: ENV.appUrl || null,
      appBaseDomain: ENV.appBaseDomain || null,
      brevoConfigured: Boolean(ENV.brevoApiKey),
      oauthConfigured: Boolean(ENV.oAuthServerUrl && ENV.appId),
      demoAuthEnabled: ENV.demoAuthEnabled,
      demoAuthAllowProduction: ENV.demoAuthAllowProduction,
      forgeConfigured: Boolean(ENV.forgeApiKey),
      bootstrapSecretConfigured: Boolean(ENV.superadminBootstrapSecret),
      platformName: settings.agency_name || "Cliavo",
      defaultLocale: settings.default_locale || "en",
      supportedLocales: (() => {
        try {
          return JSON.parse(settings.supported_locales || '["en","fr","de","it","ar"]') as string[];
        } catch {
          return ["en", "fr", "de", "it", "ar"];
        }
      })(),
      supportEmail: settings.support_email || null,
    };
  }),

  getPlatformSettings: superadminProcedure.query(async () => {
    const settings = await getAgencySettingsMap();
    let vatRates = { standard: 8.1, reduced: 2.6, special: 3.8, zero: 0 };
    try {
      vatRates = { ...vatRates, ...JSON.parse(settings.vat_rates || "{}") };
    } catch {
      /* defaults */
    }
    let supportedLocales = ["en", "fr", "de", "it", "ar"];
    try {
      supportedLocales = JSON.parse(settings.supported_locales || '["en","fr","de","it","ar"]');
    } catch {
      /* defaults */
    }
    return {
      agencyName: settings.agency_name || "Cliavo",
      logoUrl: settings.logo_url || "",
      supportEmail: settings.support_email || "",
      defaultLocale: (settings.default_locale as "en" | "fr" | "de" | "it" | "ar") || "en",
      supportedLocales,
      vatRates,
      adyen: {
        apiKeySet: Boolean(settings.adyen_api_key),
        merchantAccount: settings.adyen_merchant_account || "",
        clientKeySet: Boolean(settings.adyen_client_key),
      },
      calendar: {
        googleClientId: settings.google_calendar_client_id || "",
        googleSecretSet: Boolean(settings.google_calendar_client_secret),
        microsoftClientId: settings.microsoft_calendar_client_id || "",
        microsoftSecretSet: Boolean(settings.microsoft_calendar_client_secret),
        microsoftTenant: settings.microsoft_calendar_tenant || "common",
      },
    };
  }),

  updatePlatformSettings: superadminProcedure
    .input(
      z.object({
        agencyName: z.string().min(1).max(120).optional(),
        logoUrl: z.string().url().optional().or(z.literal("")),
        supportEmail: z.string().email().optional().or(z.literal("")),
        defaultLocale: z.enum(["en", "fr", "de", "it", "ar"]).optional(),
        supportedLocales: z.array(z.enum(["en", "fr", "de", "it", "ar"])).min(1).optional(),
        vatRates: z
          .object({
            standard: z.number().min(0).max(100),
            reduced: z.number().min(0).max(100),
            special: z.number().min(0).max(100),
            zero: z.number().min(0).max(100),
          })
          .optional(),
        adyenApiKey: z.string().optional(),
        adyenMerchantAccount: z.string().optional(),
        adyenClientKey: z.string().optional(),
        googleCalendarClientId: z.string().optional(),
        googleCalendarClientSecret: z.string().optional(),
        microsoftCalendarClientId: z.string().optional(),
        microsoftCalendarClientSecret: z.string().optional(),
        microsoftCalendarTenant: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.agencyName !== undefined) await upsertAgencySetting("agency_name", input.agencyName);
      if (input.logoUrl !== undefined) await upsertAgencySetting("logo_url", input.logoUrl);
      if (input.supportEmail !== undefined) await upsertAgencySetting("support_email", input.supportEmail);
      if (input.defaultLocale !== undefined) await upsertAgencySetting("default_locale", input.defaultLocale);
      if (input.supportedLocales !== undefined) {
        await upsertAgencySetting("supported_locales", JSON.stringify(input.supportedLocales));
      }
      if (input.vatRates !== undefined) {
        await upsertAgencySetting("vat_rates", JSON.stringify(input.vatRates));
      }
      if (input.adyenApiKey) await upsertAgencySetting("adyen_api_key", input.adyenApiKey);
      if (input.adyenMerchantAccount !== undefined) {
        await upsertAgencySetting("adyen_merchant_account", input.adyenMerchantAccount);
      }
      if (input.adyenClientKey) await upsertAgencySetting("adyen_client_key", input.adyenClientKey);

      const { upsertCalendarOAuthSettings } = await import("../platformCalendarConfig");
      await upsertCalendarOAuthSettings({
        googleClientId: input.googleCalendarClientId,
        googleClientSecret: input.googleCalendarClientSecret,
        microsoftClientId: input.microsoftCalendarClientId,
        microsoftClientSecret: input.microsoftCalendarClientSecret,
        microsoftTenant: input.microsoftCalendarTenant,
      });

      await audit(ctx.user.id, "update_platform_settings", "settings", undefined, {
        keys: Object.keys(input),
      });
      return { success: true };
    }),

  listAnnouncements: superadminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(platformAnnouncements)
      .orderBy(desc(platformAnnouncements.createdAt))
      .limit(100);
  }),

  createAnnouncement: superadminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        body: z.string().min(1).max(8000),
        severity: z.enum(["info", "warning", "critical"]).default("info"),
        audience: z.enum(["firm_admins", "all_members"]).default("firm_admins"),
        startsAt: z.date().optional(),
        endsAt: z.date().nullable().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(platformAnnouncements).values({
        title: input.title.trim(),
        body: input.body.trim(),
        severity: input.severity,
        audience: input.audience,
        startsAt: input.startsAt ?? new Date(),
        endsAt: input.endsAt ?? null,
        isActive: input.isActive,
        createdByUserId: ctx.user.id,
      });
      await audit(ctx.user.id, "create_announcement", "announcement", Number(row.insertId));
      return { id: Number(row.insertId) };
    }),

  updateAnnouncement: superadminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        body: z.string().min(1).max(8000).optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        audience: z.enum(["firm_admins", "all_members"]).optional(),
        startsAt: z.date().optional(),
        endsAt: z.date().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db
        .update(platformAnnouncements)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(platformAnnouncements.id, id));
      await audit(ctx.user.id, "update_announcement", "announcement", id, rest);
      return { success: true as const };
    }),

  deleteAnnouncement: superadminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(announcementDismissals).where(eq(announcementDismissals.announcementId, input.id));
      await db.delete(platformAnnouncements).where(eq(platformAnnouncements.id, input.id));
      await audit(ctx.user.id, "delete_announcement", "announcement", input.id);
      return { success: true as const };
    }),

  seedDefaultPlans: superadminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const existing = await db.select().from(subscriptionPlans).limit(1);
    if (existing[0]) {
      return { created: 0, message: "Plans already exist" };
    }

    const defaults = [
      {
        name: "Starter",
        description: "Solo practitioners and small teams",
        maxUsers: 3,
        monthlyPrice: "149.00",
        yearlyPrice: "1490.00",
        features: JSON.stringify(["Cases", "Clients", "Documents", "Time tracking"]),
        sortOrder: 1,
      },
      {
        name: "Professional",
        description: "Growing firms with billing and portal",
        maxUsers: 15,
        monthlyPrice: "399.00",
        yearlyPrice: "3990.00",
        features: JSON.stringify([
          "Everything in Starter",
          "Client portal",
          "Invoices & payments",
          "AI document analysis",
        ]),
        sortOrder: 2,
      },
      {
        name: "Enterprise",
        description: "Multi-office firms with priority support",
        maxUsers: 100,
        monthlyPrice: "999.00",
        yearlyPrice: "9990.00",
        features: JSON.stringify([
          "Everything in Professional",
          "Custom domain",
          "SSO-ready",
          "Dedicated support",
        ]),
        sortOrder: 3,
      },
    ];

    for (const plan of defaults) {
      await db.insert(subscriptionPlans).values(plan);
    }
    await audit(ctx.user.id, "seed_default_plans", "plan", undefined, { count: defaults.length });
    return { created: defaults.length, message: "Default plans created" };
  }),
});
