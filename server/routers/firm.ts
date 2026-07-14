import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { sendFirmInviteEmail, sendClientInviteEmail } from "../email";
import {
  acceptInvitation,
  createFirm,
  createFirmMember,
  createInvitation,
  getFirmById,
  getFirmMember,
  getFirmMemberByUserId,
  getFirmMembers,
  getInvitationByToken,
  updateFirm,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const firmRouter = router({
  // Get current user's firm context
  myFirm: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return null;
    const firm = await getFirmById(member.firmId);
    return firm ? { firm, member } : null;
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
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 80) + "-" + nanoid(6);
      await createFirm({ name: input.name, slug, address: input.address, phone: input.phone, email: input.email, website: input.website, vatNumber: input.vatNumber });
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
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || member.firmRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateFirm(member.firmId, input);
      return { success: true };
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

async function getFirmBySlug(slug: string) {
  const { getFirmBySlug: _getFirmBySlug } = await import("../db");
  return _getFirmBySlug(slug);
}
