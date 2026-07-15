import { z } from "zod";
import { protectedProcedure, router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { firms, firmSubscriptions, subscriptionPlans, users, invitations } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Superadmin router — manage firms, subscriptions, and global settings
 * All procedures require superadmin role
 */

const isSuperadmin = async (userId: number) => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user[0]?.role === "superadmin";
};

export const superadminRouter = router({
  // ─── Firms Management ─────────────────────────────────────────────────────
  listFirms: protectedProcedure.query(async ({ ctx }) => {
    if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allFirms = await db
      .select()
      .from(firms)
      .orderBy(desc(firms.createdAt));

    // Enrich with subscription data
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

  createFirm: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        address: z.string().optional(),
        phone: z.string().optional(),
        vatNumber: z.string().optional(),
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify plan exists
      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Create firm
      const slug = input.name.toLowerCase().replace(/\s+/g, "-").slice(0, 50);
      const result = await db.insert(firms).values({
        name: input.name,
        slug,
        email: input.email,
        address: input.address,
        phone: input.phone,
        vatNumber: input.vatNumber,
      });

      const firmId = result[0].insertId as number;

      // Create subscription
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

      // Create invitation for firm owner
      const inviteToken = Math.random().toString(36).substring(2, 15);
      await db.insert(invitations).values({
        invitedByUserId: ctx.user.id,
        firmId,
        email: input.email,
        role: "lawyer",
        token: inviteToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return { firmId, slug, inviteToken };
    }),

  getFirmDetails: protectedProcedure
    .input(z.object({ firmId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
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

  updateFirmSubscription: protectedProcedure
    .input(
      z.object({
        firmId: z.number(),
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
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
        })
        .where(eq(firmSubscriptions.id, sub[0].id));

      return { success: true };
    }),

  suspendFirm: protectedProcedure
    .input(z.object({ firmId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(firmSubscriptions)
        .set({ status: "suspended" })
        .where(eq(firmSubscriptions.firmId, input.firmId));

      return { success: true };
    }),

  // ─── Subscription Plans Management ────────────────────────────────────────
  listPlans: protectedProcedure.query(async ({ ctx }) => {
    if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }),

  createPlan: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        maxUsers: z.number().min(1),
        monthlyPrice: z.number().min(0),
        yearlyPrice: z.number().min(0),
        features: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db.insert(subscriptionPlans).values({
        name: input.name,
        description: input.description,
        maxUsers: input.maxUsers,
        monthlyPrice: input.monthlyPrice.toString(),
        yearlyPrice: input.yearlyPrice.toString(),
        features: input.features ? JSON.stringify(input.features) : null,
      });

      return { planId: result[0].insertId };
    }),

  updatePlan: protectedProcedure
    .input(
      z.object({
        planId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        maxUsers: z.number().optional(),
        monthlyPrice: z.number().optional(),
        yearlyPrice: z.number().optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updates: Record<string, any> = {};
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

  // ─── Superadmin Setup ────────────────────────────────────────────────────────
  /**
   * Setup endpoint: designate the current authenticated user as superadmin
   * Only works if no superadmin exists yet (first-time setup)
   */
  setupSuperadmin: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Check if any superadmin already exists
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

    // Promote current user to superadmin
    await db.update(users).set({ role: "superadmin" }).where(eq(users.id, ctx.user.id));

    return { success: true, message: "You have been designated as superadmin." };
  }),

  // Get firm detail with billing history, usage metrics, and activity
  getFirmDetail: protectedProcedure
    .input(z.object({ firmId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get firm and subscription
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

      // Get billing history (invoices)
      const { invoices: invoicesTable } = await import("../../drizzle/schema");
      const billingHistory = await db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.firmId, input.firmId))
        .orderBy(desc(invoicesTable.createdAt))
        .limit(20);

      // Get usage metrics
      const { cases: casesTable, clients: clientsTable, documents: documentsTable, messages: messagesTable } = await import("../../drizzle/schema");
      
      const caseCount = await db.select().from(casesTable).where(eq(casesTable.firmId, input.firmId));
      const clientCount = await db.select().from(clientsTable).where(eq(clientsTable.firmId, input.firmId));
      const documentCount = await db.select().from(documentsTable).where(eq(documentsTable.firmId, input.firmId));
      const messageCount = await db.select().from(messagesTable).where(eq(messagesTable.firmId, input.firmId));

      // Get recent activity from cases
      const { caseEvents: caseEventsTable } = await import("../../drizzle/schema");
      const casesForFirm = await db.select().from(casesTable).where(eq(casesTable.firmId, input.firmId));
      const caseIds = casesForFirm.map(c => c.id);
      
      let recentActivity: any[] = [];
      if (caseIds.length > 0) {
        recentActivity = await db
          .select()
          .from(caseEventsTable)
          .where(eq(caseEventsTable.caseId, caseIds[0]))
          .orderBy(desc(caseEventsTable.createdAt))
          .limit(10);
      }

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
        },
        recentActivity,
      };
    }),

  // Get superadmin dashboard statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (!await isSuperadmin(ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Get all firms
    const allFirms = await db.select().from(firms);
    
    // Get active firms (with active subscription)
    const activeFirmsResult = await db
      .select()
      .from(firms)
      .innerJoin(firmSubscriptions, eq(firms.id, firmSubscriptions.firmId))
      .where(eq(firmSubscriptions.status, "active"));
    
    const activeFirmsCount = activeFirmsResult.length;
    
    // Get total users
    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;
    
    // Get total revenue from all active subscriptions
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
        const price = sub.billingCycle === "yearly" 
          ? parseFloat(plan[0].yearlyPrice as string)
          : parseFloat(plan[0].monthlyPrice as string);
        totalRevenue += price;
      }
    }

    return {
      totalFirms: allFirms.length,
      activeFirms: activeFirmsCount,
      totalUsers,
      totalRevenue,
      activeSubscriptions: activeSubscriptions.length,
    };
  }),

  // Setup superadmin by email
  setupSuperadminByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existingSuperadmin = await db
        .select()
        .from(users)
        .where(eq(users.role, "superadmin"))
        .limit(1);

      if (existingSuperadmin[0] && existingSuperadmin[0].id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only existing superadmins can designate new superadmins.",
        });
      }

      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!targetUser[0]) {
        const openId = `superadmin-${input.email}-${Date.now()}`;
        await db.insert(users).values({
          openId,
          email: input.email,
          name: "Admin",
          role: "superadmin",
          loginMethod: "oauth",
        });
        return {
          success: true,
          message: `Superadmin account created for ${input.email}. User can now log in via Manus OAuth.`,
        };
      } else {
        await db.update(users).set({ role: "superadmin" }).where(eq(users.id, targetUser[0].id));
        return {
          success: true,
          message: `${input.email} has been promoted to superadmin.`,
        };
      }
    }),
});
