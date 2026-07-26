import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  caseIntakeSubmissions,
  clientSubscriptions,
  clients,
  firmClientPackages,
  firms,
  users,
} from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  addCaseAssignment,
  createCase,
  createCaseEvent,
  getCaseById,
  getClientByUserId,
  getDb,
  getFirmMemberByUserId,
  getFirmMembers,
} from "../db";
import { hashPassword } from "../auth/password";
import { sendCaseUpdateEmail } from "../email";
import { getAppBaseUrl } from "../tenant";
import {
  getActiveClientSubscription,
  getQuotaStatus,
  parseAllowedCaseTypes,
  periodEndFrom,
  publicPackage,
} from "../clientPackages";

const caseTypeEnum = z.enum([
  "civil",
  "criminal",
  "corporate",
  "family",
  "real_estate",
  "employment",
  "tax",
  "immigration",
  "intellectual_property",
  "other",
]);

async function requireFirmAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "subadmin"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Firm admin required" });
  }
  return member;
}

export const clientPackagesRouter = router({
  /** Firm: list packages (all, including inactive). */
  listForFirm: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(firmClientPackages)
      .where(eq(firmClientPackages.firmId, member.firmId))
      .orderBy(asc(firmClientPackages.sortOrder), desc(firmClientPackages.createdAt));
  }),

  /** Logged-in client: packages available to buy/switch in the portal. */
  listForClient: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(firmClientPackages)
      .where(
        and(
          eq(firmClientPackages.firmId, client.firmId),
          eq(firmClientPackages.isActive, true),
          eq(firmClientPackages.isPublic, true)
        )
      )
      .orderBy(asc(firmClientPackages.sortOrder));
    return rows.map(publicPackage);
  }),

  /** Public catalog for a firm (by slug) — subscriber signup page. */
  listPublicByFirmSlug: publicProcedure
    .input(z.object({ firmSlug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { firm: null, packages: [] as ReturnType<typeof publicPackage>[] };
      const [firm] = await db.select().from(firms).where(eq(firms.slug, input.firmSlug)).limit(1);
      if (!firm) return { firm: null, packages: [] };
      const rows = await db
        .select()
        .from(firmClientPackages)
        .where(
          and(
            eq(firmClientPackages.firmId, firm.id),
            eq(firmClientPackages.isActive, true),
            eq(firmClientPackages.isPublic, true)
          )
        )
        .orderBy(asc(firmClientPackages.sortOrder));
      return {
        firm: { id: firm.id, name: firm.name, slug: firm.slug, logoUrl: firm.logoUrl },
        packages: rows.map(publicPackage),
      };
    }),

  createPackage: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        price: z.number().min(0),
        currency: z.string().length(3).default("CHF"),
        billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
        casesPerPeriod: z.number().int().min(0).max(1000).default(1),
        consultationHoursPerPeriod: z.number().min(0).max(1000).default(0),
        includedFixedHours: z.number().min(0).max(1000).default(0),
        highlightLabel: z.string().max(64).optional(),
        allowedCaseTypes: z.array(caseTypeEnum).optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional().default(true),
        isPublic: z.boolean().optional().default(true),
        sortOrder: z.number().int().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(firmClientPackages).values({
        firmId: member.firmId,
        name: input.name,
        description: input.description || null,
        price: input.price.toFixed(2),
        currency: input.currency.toUpperCase(),
        billingInterval: input.billingInterval,
        casesPerPeriod: input.casesPerPeriod,
        consultationHoursPerPeriod: input.consultationHoursPerPeriod.toFixed(2),
        includedFixedHours: input.includedFixedHours.toFixed(2),
        highlightLabel: input.highlightLabel?.trim() || null,
        allowedCaseTypes: input.allowedCaseTypes ? JSON.stringify(input.allowedCaseTypes) : null,
        features: input.features ? JSON.stringify(input.features) : null,
        isActive: input.isActive,
        isPublic: input.isPublic,
        sortOrder: input.sortOrder,
      });
      return { id: result[0].insertId as number };
    }),

  updatePackage: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        price: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        billingInterval: z.enum(["monthly", "yearly"]).optional(),
        casesPerPeriod: z.number().int().min(0).max(1000).optional(),
        consultationHoursPerPeriod: z.number().min(0).max(1000).optional(),
        includedFixedHours: z.number().min(0).max(1000).optional(),
        highlightLabel: z.string().max(64).optional().nullable(),
        allowedCaseTypes: z.array(caseTypeEnum).optional().nullable(),
        features: z.array(z.string()).optional().nullable(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(firmClientPackages)
        .where(and(eq(firmClientPackages.id, input.id), eq(firmClientPackages.firmId, member.firmId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const { id: _id, ...rest } = input;
      await db
        .update(firmClientPackages)
        .set({
          ...("name" in rest ? { name: rest.name } : {}),
          ...("description" in rest ? { description: rest.description ?? null } : {}),
          ...("price" in rest && rest.price != null ? { price: rest.price.toFixed(2) } : {}),
          ...("currency" in rest && rest.currency ? { currency: rest.currency.toUpperCase() } : {}),
          ...("billingInterval" in rest ? { billingInterval: rest.billingInterval } : {}),
          ...("casesPerPeriod" in rest ? { casesPerPeriod: rest.casesPerPeriod } : {}),
          ...("consultationHoursPerPeriod" in rest && rest.consultationHoursPerPeriod != null
            ? { consultationHoursPerPeriod: rest.consultationHoursPerPeriod.toFixed(2) }
            : {}),
          ...("includedFixedHours" in rest && rest.includedFixedHours != null
            ? { includedFixedHours: rest.includedFixedHours.toFixed(2) }
            : {}),
          ...("highlightLabel" in rest
            ? { highlightLabel: rest.highlightLabel?.trim() || null }
            : {}),
          ...("allowedCaseTypes" in rest
            ? {
                allowedCaseTypes:
                  rest.allowedCaseTypes == null ? null : JSON.stringify(rest.allowedCaseTypes),
              }
            : {}),
          ...("features" in rest
            ? { features: rest.features == null ? null : JSON.stringify(rest.features) }
            : {}),
          ...("isActive" in rest ? { isActive: rest.isActive } : {}),
          ...("isPublic" in rest ? { isPublic: rest.isPublic } : {}),
          ...("sortOrder" in rest ? { sortOrder: rest.sortOrder } : {}),
        })
        .where(eq(firmClientPackages.id, input.id));
      return { success: true as const };
    }),

  listSubscribers: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmAdmin(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        subscription: clientSubscriptions,
        client: clients,
        package: firmClientPackages,
      })
      .from(clientSubscriptions)
      .innerJoin(clients, eq(clients.id, clientSubscriptions.clientId))
      .innerJoin(firmClientPackages, eq(firmClientPackages.id, clientSubscriptions.packageId))
      .where(eq(clientSubscriptions.firmId, member.firmId))
      .orderBy(desc(clientSubscriptions.createdAt));
    return rows;
  }),

  /** Subscriber self-serve: create account + client + subscription. */
  registerSubscriber: publicProcedure
    .input(
      z.object({
        firmSlug: z.string().min(1),
        packageId: z.number(),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [firm] = await db.select().from(firms).where(eq(firms.slug, input.firmSlug)).limit(1);
      if (!firm) throw new TRPCError({ code: "NOT_FOUND", message: "Firm not found" });

      const [pkg] = await db
        .select()
        .from(firmClientPackages)
        .where(
          and(
            eq(firmClientPackages.id, input.packageId),
            eq(firmClientPackages.firmId, firm.id),
            eq(firmClientPackages.isActive, true),
            eq(firmClientPackages.isPublic, true)
          )
        )
        .limit(1);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "Package not available" });

      const email = input.email.trim().toLowerCase();
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Sign in instead." });
      }

      const openId = `subscriber-${firm.id}-${Date.now().toString(36)}`;
      const userInsert = await db.insert(users).values({
        openId,
        email,
        name: `${input.firstName} ${input.lastName}`.trim(),
        role: "user",
        loginMethod: "password",
        passwordHash: hashPassword(input.password),
        mustChangePassword: false,
      });
      const userId = userInsert[0].insertId as number;

      const clientInsert = await db.insert(clients).values({
        firmId: firm.id,
        userId,
        type: "individual",
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: input.phone || null,
        status: "active",
        accessType: "subscriber",
        onboardingCompletedAt: new Date(),
      });
      const clientId = clientInsert[0].insertId as number;

      const start = new Date();
      const end = periodEndFrom(start, pkg.billingInterval);
      await db.insert(clientSubscriptions).values({
        firmId: firm.id,
        clientId,
        packageId: pkg.id,
        status: "active",
        billingInterval: pkg.billingInterval,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      });

      return { ok: true as const, clientId, packageId: pkg.id, loginHint: email };
    }),

  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) return null;
    const quota = await getQuotaStatus(client.id);
    if (!quota.hasSubscription || !quota.package || !quota.subscription) {
      return {
        accessType: client.accessType,
        hasSubscription: false as const,
        quota,
      };
    }
    return {
      accessType: client.accessType,
      hasSubscription: true as const,
      quota,
      package: publicPackage(quota.package),
      subscription: {
        id: quota.subscription.id,
        status: quota.subscription.status,
        billingInterval: quota.subscription.billingInterval,
        currentPeriodStart: quota.subscription.currentPeriodStart,
        currentPeriodEnd: quota.subscription.currentPeriodEnd,
      },
    };
  }),

  /**
   * Client buys / switches package from the portal.
   * Standard firm clients become subscribers when they purchase a plan.
   */
  changePlan: protectedProcedure
    .input(z.object({ packageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [pkg] = await db
        .select()
        .from(firmClientPackages)
        .where(
          and(
            eq(firmClientPackages.id, input.packageId),
            eq(firmClientPackages.firmId, client.firmId),
            eq(firmClientPackages.isActive, true)
          )
        )
        .limit(1);
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "Package not available" });

      const active = await getActiveClientSubscription(client.id);
      const start = new Date();
      const end = periodEndFrom(start, pkg.billingInterval);

      if (active) {
        await db
          .update(clientSubscriptions)
          .set({
            packageId: pkg.id,
            billingInterval: pkg.billingInterval,
            status: "active",
            currentPeriodStart: start,
            currentPeriodEnd: end,
            cancelledAt: null,
          })
          .where(eq(clientSubscriptions.id, active.subscription.id));
      } else {
        await db.insert(clientSubscriptions).values({
          firmId: client.firmId,
          clientId: client.id,
          packageId: pkg.id,
          status: "active",
          billingInterval: pkg.billingInterval,
          currentPeriodStart: start,
          currentPeriodEnd: end,
        });
      }
      if (client.accessType !== "subscriber") {
        await db
          .update(clients)
          .set({ accessType: "subscriber", status: "active" })
          .where(eq(clients.id, client.id));
      }
      return { success: true as const };
    }),

  getIntakeForCase: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [intake] = await db
        .select()
        .from(caseIntakeSubmissions)
        .where(eq(caseIntakeSubmissions.caseId, input.caseId))
        .limit(1);
      if (!intake) return null;

      const member = await getFirmMemberByUserId(ctx.user.id);
      const client = await getClientByUserId(ctx.user.id);
      const isFirm =
        !!member &&
        member.firmId === intake.firmId &&
        ["admin", "subadmin", "lawyer", "collaborator", "assistant"].includes(member.firmRole);
      const isOwnerClient = !!client && client.id === intake.clientId;
      if (!isFirm && !isOwnerClient) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return intake;
    }),

  /**
   * Subscribed client creates a legal issue with full intake questionnaire.
   * Enforces package case quota for the current period.
   */
  createCaseIntake: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(255),
        type: caseTypeEnum.default("other"),
        privacyLevel: z.enum(["private", "sensitive", "standard"]).default("standard"),
        relatedLawArea: z.string().min(1).max(64),
        desiredOutcome: z.string().min(10).max(5000),
        happenedAt: z.string().min(1).max(100),
        howItHappened: z.string().min(10).max(10000),
        involvement: z.string().min(5).max(5000),
        additionalNotes: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN", message: "Client profile required" });

      const quota = await getQuotaStatus(client.id);
      if (client.accessType === "subscriber") {
        if (!quota.hasSubscription) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You need an active package subscription to open a case.",
          });
        }
        if (!quota.canCreateCase) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Case limit reached for this period (${quota.casesUsed}/${quota.casesAllowed}). Upgrade your plan or wait until the next period.`,
          });
        }
        const allowed = quota.package ? parseAllowedCaseTypes(quota.package) : null;
        if (allowed && !allowed.includes(input.type)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This case type is not included in your package.",
          });
        }
      }

      const description = [
        `Desired outcome: ${input.desiredOutcome}`,
        `When it happened: ${input.happenedAt}`,
        `How it happened: ${input.howItHappened}`,
        `Involvement: ${input.involvement}`,
        input.additionalNotes ? `Notes: ${input.additionalNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const ref = `LIT-${Date.now().toString(36).toUpperCase()}`;
      const insertResult = await createCase({
        firmId: client.firmId,
        title: input.title,
        referenceNumber: ref,
        type: input.type,
        status: "pending",
        description,
        createdByUserId: ctx.user.id,
      });
      const newCaseId = Number((insertResult as { insertId?: number }).insertId ?? 0);
      const newCase = newCaseId ? await getCaseById(newCaseId, client.firmId) : null;
      if (!newCase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await addCaseAssignment({
        caseId: newCase.id,
        clientId: client.id,
        assignmentType: "client",
        assignedByUserId: ctx.user.id,
      });

      const db = await getDb();
      if (db) {
        await db.insert(caseIntakeSubmissions).values({
          firmId: client.firmId,
          caseId: newCase.id,
          clientId: client.id,
          formVersion: "intake_v1",
          privacyLevel: input.privacyLevel,
          relatedLawArea: input.relatedLawArea,
          desiredOutcome: input.desiredOutcome,
          happenedAt: input.happenedAt,
          howItHappened: input.howItHappened,
          involvement: input.involvement,
          answersJson: JSON.stringify(input),
        });
      }

      await createCaseEvent({
        caseId: newCase.id,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "shared",
        title: "Legal issue submitted (intake questionnaire)",
        content: description,
      });

      const members = await getFirmMembers(client.firmId);
      const caseUrl = `${getAppBaseUrl(ctx.req)}/cases/${newCase.id}`;
      if (db) {
        for (const m of members.filter((x) =>
          ["admin", "subadmin", "lawyer"].includes(x.member.firmRole)
        )) {
          const [u] = await db.select().from(users).where(eq(users.id, m.member.userId)).limit(1);
          if (!u?.email) continue;
          await sendCaseUpdateEmail({
            recipientEmail: u.email,
            recipientName: u.name || u.email,
            caseTitle: newCase.title,
            updateTitle: "New subscribed-client case intake",
            updateBody: `${client.firstName || client.companyName || "A subscriber"} submitted: ${input.title} (${input.relatedLawArea})`,
            caseUrl,
          }).catch((err) => console.error("[Email] intake:", err.message));
        }
      }

      return { case: newCase, quota: await getQuotaStatus(client.id) };
    }),
});
