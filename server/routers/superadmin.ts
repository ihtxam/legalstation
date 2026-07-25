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
} from "../../drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { ENV } from "../_core/env";
import {
  generateTemporaryPassword,
  hashPassword,
  slugifyFirmName,
} from "../auth/password";
import { isReservedSubdomain, firmLoginUrl, getAppBaseUrl } from "../tenant";
import { sendFirmCredentialsEmail } from "../email";
import { nanoid } from "nanoid";

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
        slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
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

      const baseSlug = input.slug || slugifyFirmName(input.name);
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
        name: z.string().optional(),
        description: z.string().optional(),
        maxUsers: z.number().int().positive().optional(),
        monthlyPrice: z.number().nonnegative().optional(),
        yearlyPrice: z.number().nonnegative().optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.maxUsers !== undefined) updates.maxUsers = input.maxUsers;
      if (input.monthlyPrice !== undefined) updates.monthlyPrice = input.monthlyPrice.toString();
      if (input.yearlyPrice !== undefined) updates.yearlyPrice = input.yearlyPrice.toString();
      if (input.features !== undefined) updates.features = JSON.stringify(input.features);
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, input.planId));
      return { success: true };
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
});
