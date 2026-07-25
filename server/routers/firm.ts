import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { sendFirmInviteEmail, sendClientInviteEmail } from "../email";
import {
  acceptInvitation,
  countFirms,
  createFirm,
  createFirmMember,
  createInvitation,
  getFirmById,
  getFirmBySlug,
  getFirmMember,
  getFirmMemberByUserId,
  getFirmMembers,
  getInvitationByToken,
  updateFirm,
} from "../db";
import { resolveFirmContext } from "../access";
import { protectedProcedure, router } from "../_core/trpc";
import { isSingleTenant } from "../deployment";
import { evaluateLicense } from "../license";

export const firmRouter = router({
  // Get current user's firm context
  myFirm: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return null;
    const firm = await getFirmById(member.firmId);
    return firm ? { firm, member } : null;
  }),

  // Get firm branding (logo, name, colors) - accessible to firm members and clients
  branding: protectedProcedure.query(async ({ ctx }) => {
    const firmCtx = await resolveFirmContext(ctx.user.id);
    if (!firmCtx) return null;
    const firm = await getFirmById(firmCtx.firmId);
    if (!firm) return null;
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
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || member.firmRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { defaultVatRate, defaultCurrency, ...rest } = input;
      await updateFirm(member.firmId, {
        ...rest,
        defaultCurrency: defaultCurrency?.toUpperCase(),
        defaultVatRate: defaultVatRate != null ? defaultVatRate.toFixed(2) : undefined,
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
          .regex(/^#[0-9A-Fa-f]{6}$/, "Primary color must be a hex value like #001f3f")
          .optional(),
        secondaryColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, "Accent color must be a hex value like #c9a227")
          .optional(),
        defaultCurrency: z.string().length(3).optional(),
        defaultVatRate: z.number().min(0).max(100).optional(),
        slug: z.string().max(50).optional(),
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

      if (input.slug !== undefined && input.slug.trim()) {
        const cleanSlug = slugifyFirmName(input.slug);
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
      email: z.string().email(),
      role: z.enum(["lawyer", "assistant", "client"]),
      clientId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createInvitation({
        firmId: member.firmId,
        email: input.email,
        role: input.role,
        token,
        invitedByUserId: ctx.user.id,
        clientId: input.clientId,
        expiresAt,
      });
      const inviteUrl = `${ctx.req.headers.origin}/invite/${token}`;
      const firm = await getFirmById(member.firmId);
      
      // Send email based on role
      if (input.role === "client") {
        await sendClientInviteEmail(input.email, firm?.name || "Your Firm", inviteUrl).catch(err => {
          console.error("[Email] Failed to send client invite:", err.message);
        });
      } else {
        await sendFirmInviteEmail(input.email, firm?.name || "Your Firm", inviteUrl, ctx.user.name || "Your colleague").catch(err => {
          console.error("[Email] Failed to send firm invite:", err.message);
        });
      }
      
      return { token, inviteUrl };
    }),

  // Accept an invitation
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      if (invitation.acceptedAt) throw new TRPCError({ code: "CONFLICT", message: "Invitation already accepted" });
      if (invitation.expiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation expired" });
      const existingMember = await getFirmMemberByUserId(ctx.user.id);
      if (invitation.role === "client") {
        // For client invitations, link the user account to the client profile
        if (invitation.clientId) {
          const db = await import("../db").then(m => m.getDb());
          if (db) {
            const { clients } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await db.update(clients).set({ userId: ctx.user.id, status: "active" }).where(eq(clients.id, invitation.clientId));
          }
        }
      } else if (!existingMember) {
        await createFirmMember({ firmId: invitation.firmId, userId: ctx.user.id, firmRole: invitation.role as "admin" | "lawyer" | "assistant" });
      }
      await acceptInvitation(invitation.id);
      return { success: true, firmId: invitation.firmId };
    }),
});


