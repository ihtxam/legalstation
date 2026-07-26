import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { sendFirmInviteEmail, sendClientInviteEmail } from "../email";
import {
  acceptInvitation,
  countFirms,
  createFirm,
  createFirmMember,
  createInvitation,
  getDb,
  getFirmById,
  getFirmBySlug,
  getFirmMember,
  getFirmMemberByUserId,
  getFirmMembers,
  getInvitationByToken,
  getUserByEmail,
  updateFirm,
} from "../db";
import { clients, firmSubscriptions, subscriptionPlans, users } from "../../drizzle/schema";
import { resolveFirmContext } from "../access";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { hashPassword } from "../auth/password";
import { isSingleTenant } from "../deployment";
import { evaluateLicense } from "../license";
import { getAppBaseUrl } from "../tenant";

const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Invalid email address" }));

function normalizeEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

async function applyInvitationToUser(opts: {
  invitation: NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>;
  userId: number;
  userEmail: string | null | undefined;
}) {
  const invitedEmail = normalizeEmail(opts.invitation.email);
  const userEmail = normalizeEmail(opts.userEmail);
  if (!userEmail || userEmail !== invitedEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This invitation is for ${opts.invitation.email}. Sign in with that email address.`,
    });
  }
  if (opts.invitation.acceptedAt) {
    throw new TRPCError({ code: "CONFLICT", message: "Invitation already accepted" });
  }
  if (opts.invitation.expiresAt < new Date()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation expired" });
  }

  const existingMember = await getFirmMemberByUserId(opts.userId);
  if (opts.invitation.role === "client") {
    if (opts.invitation.clientId) {
      const db = await getDb();
      if (db) {
        await db
          .update(clients)
          .set({ userId: opts.userId, status: "active" })
          .where(eq(clients.id, opts.invitation.clientId));
      }
    }
  } else if (!existingMember) {
    const staffRole =
      opts.invitation.role === "subadmin" ||
      opts.invitation.role === "lawyer" ||
      opts.invitation.role === "assistant"
        ? opts.invitation.role
        : "lawyer";
    await createFirmMember({
      firmId: opts.invitation.firmId,
      userId: opts.userId,
      firmRole: staffRole,
    });
  } else if (existingMember.firmId !== opts.invitation.firmId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You already belong to another firm",
    });
  }

  await acceptInvitation(opts.invitation.id);
  return { success: true as const, firmId: opts.invitation.firmId, role: opts.invitation.role };
}

export const firmRouter = router({
  // Get current user's firm context
  myFirm: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return null;
    const firm = await getFirmById(member.firmId);
    if (!firm) return null;

    const db = await getDb();
    let subscription: {
      status: string;
      trialEndsAt: Date | null;
      currentPeriodEnd: Date | null;
      planName: string | null;
      trialActive: boolean;
      trialExpired: boolean;
      trialDaysLeft: number;
    } | null = null;

    if (db) {
      const [row] = await db
        .select({
          status: firmSubscriptions.status,
          trialEndsAt: firmSubscriptions.trialEndsAt,
          currentPeriodEnd: firmSubscriptions.currentPeriodEnd,
          planName: subscriptionPlans.name,
        })
        .from(firmSubscriptions)
        .leftJoin(subscriptionPlans, eq(firmSubscriptions.planId, subscriptionPlans.id))
        .where(eq(firmSubscriptions.firmId, firm.id))
        .limit(1);

      if (row) {
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
        subscription = {
          status: row.status,
          trialEndsAt,
          currentPeriodEnd: row.currentPeriodEnd,
          planName: row.planName,
          trialActive,
          trialExpired,
          trialDaysLeft,
        };
      }
    }

    const { getMemberCapabilityFlags } = await import("../firmPermissions");
    const capabilities = await getMemberCapabilityFlags(firm.id, member.firmRole);
    const { getFirmStorageUsage, bytesToGbLabel } = await import("../firmStorage");
    const storage = await getFirmStorageUsage(firm.id);

    return {
      firm,
      member,
      subscription,
      storage: {
        ...storage,
        usedLabel: bytesToGbLabel(storage.usedBytes),
        quotaLabel: bytesToGbLabel(storage.quotaBytes),
      },
      capabilities: {
        canManageFirmSettings: capabilities.canManageFirmSettings,
        canInviteStaff: capabilities.canInviteStaff,
        canInviteClients: capabilities.canInviteClients,
        canAccessAdminConsole: capabilities.canAccessAdminConsole,
        canSeeFirmWideCases: capabilities.canSeeFirmWideCases,
        canSeeFirmWideInvoices: capabilities.canSeeFirmWideInvoices,
        canCreateInvoice: capabilities.canCreateInvoice,
        hasOverrides: capabilities.hasOverrides,
      },
    };
  }),

  /** Effective role × function matrix for this firm (defaults + overrides). */
  getRoleCapabilities: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    const { getFirmCapabilityMatrix } = await import("../firmPermissions");
    const { canManageFirmSettings } = await import("@shared/roles");
    const { matrix, hasOverrides } = await getFirmCapabilityMatrix(member.firmId);
    const canEdit = canManageFirmSettings(member.firmRole, matrix);
    return {
      matrix,
      hasOverrides,
      canEdit,
      editableRoles: ["subadmin", "lawyer", "assistant", "client"] as const,
      lockedCells: [{ capabilityId: "firmSettings", role: "admin" as const }],
    };
  }),

  /** Save admin edits to the authorization matrix. */
  updateRoleCapabilities: protectedProcedure
    .input(
      z.object({
        matrix: z.array(
          z.object({
            id: z.enum([
              "firmSettings",
              "inviteStaff",
              "inviteClients",
              "cmsAnalyticsAudit",
              "allCases",
              "assignedCases",
              "allInvoices",
              "caseInvoices",
              "createEditInvoices",
              "securityLanguage",
            ]),
            access: z.object({
              admin: z.enum(["none", "view", "own", "full"]),
              subadmin: z.enum(["none", "view", "own", "full"]),
              lawyer: z.enum(["none", "view", "own", "full"]),
              assistant: z.enum(["none", "view", "own", "full"]),
              client: z.enum(["none", "view", "own", "full"]),
            }),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const { getFirmCapabilityMatrix } = await import("../firmPermissions");
      const {
        canManageFirmSettings,
        diffRoleCapabilityOverrides,
        mergeRoleCapabilityMatrix,
        ROLE_CAPABILITY_MATRIX,
      } = await import("@shared/roles");
      const { matrix: current } = await getFirmCapabilityMatrix(member.firmId);
      if (!canManageFirmSettings(member.firmRole, current)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only firm admins can edit roles" });
      }

      // Rebuild full rows (preserve label keys from defaults)
      const byId = new Map(ROLE_CAPABILITY_MATRIX.map((r) => [r.id, r]));
      const nextRows = input.matrix.map((row) => {
        const base = byId.get(row.id);
        if (!base) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown capability ${row.id}` });
        return {
          ...base,
          access: {
            ...row.access,
            // Hard lock: admin always manages firm settings
            ...(row.id === "firmSettings" ? { admin: "full" as const } : {}),
          },
        };
      });

      // Ensure every default capability is present
      for (const base of ROLE_CAPABILITY_MATRIX) {
        if (!nextRows.find((r) => r.id === base.id)) {
          nextRows.push(base);
        }
      }

      const overrides = diffRoleCapabilityOverrides(nextRows);
      const payload = Object.keys(overrides).length ? JSON.stringify(overrides) : null;
      await updateFirm(member.firmId, { roleCapabilityOverrides: payload });
      return {
        success: true as const,
        matrix: mergeRoleCapabilityMatrix(overrides),
        hasOverrides: Boolean(payload),
      };
    }),

  resetRoleCapabilities: protectedProcedure.mutation(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    const { getFirmCapabilityMatrix } = await import("../firmPermissions");
    const { canManageFirmSettings, ROLE_CAPABILITY_MATRIX } = await import("@shared/roles");
    const { matrix: current } = await getFirmCapabilityMatrix(member.firmId);
    if (!canManageFirmSettings(member.firmRole, current)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only firm admins can edit roles" });
    }
    await updateFirm(member.firmId, { roleCapabilityOverrides: null });
    return { success: true as const, matrix: ROLE_CAPABILITY_MATRIX, hasOverrides: false };
  }),

  // Get firm branding (logo, name, colors) - accessible to firm members and clients
  branding: protectedProcedure.query(async ({ ctx }) => {
    const firmCtx = await resolveFirmContext(ctx.user.id);
    if (!firmCtx) return null;
    const firm = await getFirmById(firmCtx.firmId);
    if (!firm) return null;
    const { resolveUploadPolicy } = await import("@shared/uploadPolicy");
    const uploadPolicy = resolveUploadPolicy({
      maxUploadBytes: firm.maxUploadBytes,
      allowedUploadTypes: firm.allowedUploadTypes,
    });
    return {
      name: firm.name,
      logoUrl: firm.logoUrl,
      email: firm.email,
      slug: firm.slug,
      primaryColor: firm.primaryColor,
      secondaryColor: firm.secondaryColor,
      defaultCurrency: firm.defaultCurrency,
      defaultVatRate: firm.defaultVatRate,
      customDomain: firm.customDomain,
      subdomainStatus: firm.subdomainStatus,
      onboardingCompletedAt: firm.onboardingCompletedAt,
      onboardingStep: firm.onboardingStep,
      maxUploadBytes: uploadPolicy.maxUploadBytes,
      allowedUploadTypes: uploadPolicy.allowedExtensions,
      uploadPolicy,
    };
  }),

  // Create a new firm (onboarding)
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(255),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      website: z.string().optional(),
      vatNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getFirmMemberByUserId(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member of a firm" });

      if (isSingleTenant()) {
        const firmCount = await countFirms();
        if (firmCount > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Single-tenant / on-premise mode allows only one firm workspace",
          });
        }
        const license = evaluateLicense();
        if (!license.valid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `License invalid: ${license.reason ?? "unknown"}`,
          });
        }
      }

      const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 80) + "-" + nanoid(6);
      await createFirm({
        name: input.name,
        slug,
        address: input.address,
        phone: input.phone,
        email: input.email,
        website: input.website,
        vatNumber: input.vatNumber,
        subdomainStatus: "pending",
        onboardingStep: 0,
      });
      const firm = await getFirmBySlug(slug);
      if (!firm) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await createFirmMember({ firmId: firm.id, userId: ctx.user.id, firmRole: "admin" });
      return firm;
    }),

  // Update firm settings
  update: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(255).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().nullable(),
      website: z.string().optional().nullable(),
      vatNumber: z.string().optional().nullable(),
      logoUrl: z.string().optional().nullable(),
      defaultCurrency: z.string().length(3).optional(),
      defaultVatRate: z.number().min(0).max(100).optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      customDomain: z.string().max(255).optional().nullable(),
      /** Max upload size in MB (converted to bytes server-side). */
      maxUploadMb: z.number().min(0.1).max(50).optional(),
      /** Allowed extensions without dots, e.g. ["pdf","jpg","png"]. */
      allowedUploadTypes: z.array(z.string().min(1).max(20)).max(40).optional(),
      /** Swiss banking for QR-bill (page 2 of invoices). */
      iban: z.string().max(34).optional().nullable(),
      qrIban: z.string().max(34).optional().nullable(),
      creditorStreet: z.string().max(70).optional().nullable(),
      creditorBuildingNumber: z.string().max(16).optional().nullable(),
      creditorPostalCode: z.string().max(16).optional().nullable(),
      creditorCity: z.string().max(35).optional().nullable(),
      creditorCountry: z.string().length(2).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const { getFirmCapabilityMatrix } = await import("../firmPermissions");
      const { canManageFirmSettings } = await import("@shared/roles");
      const { matrix } = await getFirmCapabilityMatrix(member.firmId);
      if (!canManageFirmSettings(member.firmRole, matrix)) throw new TRPCError({ code: "FORBIDDEN" });
      const {
        defaultVatRate,
        defaultCurrency,
        maxUploadMb,
        allowedUploadTypes,
        iban,
        qrIban,
        creditorCountry,
        ...rest
      } = input;
      const { UPLOAD_HARD_MAX_BYTES } = await import("@shared/uploadPolicy");
      const normalizeIban = (v?: string | null) =>
        v == null ? v : v.replace(/\s+/g, "").toUpperCase() || null;
      const { isIBANValid } = await import("swissqrbill/utils");
      const nextIban = iban !== undefined ? normalizeIban(iban) : undefined;
      const nextQrIban = qrIban !== undefined ? normalizeIban(qrIban) : undefined;
      if (nextIban && !isIBANValid(nextIban)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "IBAN is invalid. Swiss IBANs must be 21 characters (e.g. CH93 0076 2011 6238 5295 7).",
        });
      }
      if (nextQrIban && !isIBANValid(nextQrIban)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "QR-IBAN is invalid. It must be a valid 21-character Swiss QR-IBAN.",
        });
      }
      await updateFirm(member.firmId, {
        ...rest,
        iban: nextIban,
        qrIban: nextQrIban,
        creditorCountry:
          creditorCountry !== undefined
            ? creditorCountry
              ? creditorCountry.toUpperCase()
              : "CH"
            : undefined,
        defaultCurrency: defaultCurrency?.toUpperCase(),
        defaultVatRate: defaultVatRate != null ? defaultVatRate.toFixed(2) : undefined,
        maxUploadBytes:
          maxUploadMb != null
            ? Math.min(Math.round(maxUploadMb * 1024 * 1024), UPLOAD_HARD_MAX_BYTES)
            : undefined,
        allowedUploadTypes:
          allowedUploadTypes != null
            ? JSON.stringify(
                allowedUploadTypes.map((e) => e.toLowerCase().replace(/^\./, "").trim()).filter(Boolean)
              )
            : undefined,
      });
      return { success: true };
    }),

  /** Multi-step firm onboarding (name, branding, currency/tax, subdomain). */
  completeOnboardingStep: protectedProcedure
    .input(
      z.object({
        step: z.number().int().min(1).max(5),
        name: z.string().min(2).max(255).optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        vatNumber: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        primaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, "Primary color must be a hex value like #7C3AED")
          .optional(),
        secondaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, "Accent color must be a hex value like #c9a227")
          .optional(),
        defaultCurrency: z.string().length(3).optional(),
        defaultVatRate: z.number().min(0).max(100).optional(),
        // Accept any string — we sanitize with slugifyFirmName below (no Zod regex)
        slug: z.string().max(80).optional(),
        customDomain: z.string().max(255).nullable().optional(),
        finish: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || member.firmRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const { slugifyFirmName } = await import("../auth/password");
      const updates: Record<string, unknown> = {
        onboardingStep: input.step,
      };
      if (input.name) updates.name = input.name;
      if (input.address !== undefined) updates.address = input.address;
      if (input.phone !== undefined) updates.phone = input.phone;
      if (input.email) updates.email = input.email;
      if (input.vatNumber !== undefined) updates.vatNumber = input.vatNumber;
      if (input.logoUrl !== undefined) updates.logoUrl = input.logoUrl || null;
      if (input.primaryColor) updates.primaryColor = input.primaryColor;
      if (input.secondaryColor) updates.secondaryColor = input.secondaryColor;
      if (input.defaultCurrency) updates.defaultCurrency = input.defaultCurrency.toUpperCase();
      if (input.defaultVatRate != null) updates.defaultVatRate = input.defaultVatRate.toFixed(2);
      if (input.customDomain !== undefined) {
        updates.customDomain = input.customDomain?.trim() ? input.customDomain.trim() : null;
      }

      if (input.slug !== undefined && String(input.slug).trim()) {
        const cleanSlug = slugifyFirmName(String(input.slug));
        if (!cleanSlug || cleanSlug.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subdomain must use letters, numbers, and hyphens only",
          });
        }
        const { isReservedSubdomain } = await import("../tenant");
        if (isReservedSubdomain(cleanSlug)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This subdomain is reserved" });
        }
        const existing = await getFirmBySlug(cleanSlug);
        if (existing && existing.id !== member.firmId) {
          throw new TRPCError({ code: "CONFLICT", message: "Subdomain already taken" });
        }
        updates.slug = cleanSlug;
        updates.subdomainStatus = "pending";
      }

      if (input.finish) {
        updates.onboardingCompletedAt = new Date();
        updates.onboardingStep = 5;
        if (!updates.subdomainStatus) updates.subdomainStatus = "active";
      }

      try {
        await updateFirm(member.firmId, updates as any);
      } catch (err: any) {
        console.error("[Firm] onboarding update failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message || "Could not save onboarding step",
        });
      }
      return { success: true, step: input.step, completed: Boolean(input.finish) };
    }),

  // Get all firm members
  members: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
    return getFirmMembers(member.firmId);
  }),

  // Invite a team member
  invite: protectedProcedure
    .input(z.object({
      email: inviteEmailSchema,
      role: z.enum(["subadmin", "lawyer", "assistant", "client"]),
      clientId: z.number().optional(),
      /** Language for the invite email + preferred join UI (admin choice at invite time). */
      emailLanguage: z.enum(["en", "fr", "de", "it", "ar"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      const { canInviteClient, canInviteStaff, getInvitableRoles } = await import("@shared/roles");
      const { isAppLocale } = await import("@shared/locales");
      const { getFirmCapabilityMatrix } = await import("../firmPermissions");
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const { matrix } = await getFirmCapabilityMatrix(member.firmId);
      const allowed = getInvitableRoles(member.firmRole, matrix);
      if (!allowed.includes(input.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot invite this role" });
      }
      // Keep explicit checks for clarity / safety
      if (input.role === "client" && !canInviteClient(member.firmRole, matrix)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.role !== "client" && input.role !== "subadmin" && !canInviteStaff(member.firmRole, matrix)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.role === "subadmin" && member.firmRole !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const locale =
        input.emailLanguage && isAppLocale(input.emailLanguage)
          ? input.emailLanguage
          : isAppLocale(ctx.user.preferredLocale)
            ? ctx.user.preferredLocale
            : "en";

      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createInvitation({
        firmId: member.firmId,
        email: input.email,
        role: input.role,
        token,
        invitedByUserId: ctx.user.id,
        clientId: input.clientId,
        emailLanguage: locale,
        expiresAt,
      });
      const inviteUrl = `${getAppBaseUrl(ctx.req)}/invite/${token}`;
      const firm = await getFirmById(member.firmId);

      let emailSent = false;
      let emailError: string | undefined;
      try {
        if (input.role === "client") {
          await sendClientInviteEmail(input.email, firm?.name || "Your Firm", inviteUrl, locale);
        } else {
          await sendFirmInviteEmail(
            input.email,
            firm?.name || "Your Firm",
            inviteUrl,
            ctx.user.name || "Your colleague",
            locale
          );
        }
        emailSent = true;
      } catch (err: any) {
        emailError = err?.message || "Failed to send invitation email";
        console.error("[Email] Failed to send invite:", emailError);
      }

      return { token, inviteUrl, emailSent, emailError, emailLanguage: locale };
    }),

  /** Public preview for invite landing page (no auth). */
  getInvite: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      const firm = await getFirmById(invitation.firmId);
      const existingUser = await getUserByEmail(invitation.email);
      return {
        email: invitation.email,
        role: invitation.role,
        firmName: firm?.name ?? "Cliavo",
        firmSlug: firm?.slug ?? null,
        emailLanguage: invitation.emailLanguage || "en",
        expired: invitation.expiresAt < new Date(),
        accepted: Boolean(invitation.acceptedAt),
        expiresAt: invitation.expiresAt,
        accountExists: Boolean(existingUser),
      };
    }),

  /**
   * Create a password account for the invited email and join the firm in one step.
   * Used when the invitee has no Cliavo account yet.
   */
  registerFromInvite: publicProcedure
    .input(
      z.object({
        token: z.string().min(10),
        name: z.string().trim().min(1).max(200),
        password: z.string().min(8).max(200),
        preferredLocale: z.enum(["en", "fr", "de", "it", "ar"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      if (invitation.acceptedAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Invitation already accepted" });
      }
      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation expired" });
      }

      const email = normalizeEmail(invitation.email);
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Sign in to accept the invitation.",
        });
      }
      const { isAppLocale } = await import("@shared/locales");
      const preferredLocale =
        (input.preferredLocale && isAppLocale(input.preferredLocale) && input.preferredLocale) ||
        (isAppLocale(invitation.emailLanguage) && invitation.emailLanguage) ||
        "en";

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const openId = `password-invite-${nanoid(12)}`;
      await db.insert(users).values({
        openId,
        email,
        name: input.name.trim(),
        role: "user",
        loginMethod: "password",
        passwordHash: hashPassword(input.password),
        preferredLocale,
        mustChangePassword: false,
        lastSignedIn: new Date(),
      });

      const user = await getUserByEmail(email);
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
      }

      const result = await applyInvitationToUser({
        invitation,
        userId: user.id,
        userEmail: user.email,
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.email || user.openId,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const redirectTo =
        invitation.role === "client" ? "/client-portal" : "/dashboard";

      return {
        ...result,
        redirectTo,
        user: { id: user.id, email: user.email, name: user.name },
      };
    }),

  // Accept an invitation (existing authenticated user)
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      return applyInvitationToUser({
        invitation,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
      });
    }),
});


