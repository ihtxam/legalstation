import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createClient,
  getClientById,
  getClientsByFirm,
  getFirmMemberByUserId,
  updateClient,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireFirmMember(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not a firm member" });
  return member;
}

export const clientsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      type: z.enum(["individual", "company"]).optional(),
      status: z.enum(["invited", "active", "inactive"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const all = await getClientsByFirm(member.firmId);
      let result = all;
      if (input?.search) {
        const q = input.search.toLowerCase();
        result = result.filter(c =>
          c.firstName?.toLowerCase().includes(q) ||
          c.lastName?.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      }
      if (input?.type) result = result.filter(c => c.type === input.type);
      if (input?.status) result = result.filter(c => c.status === input.status);
      return result;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const client = await getClientById(input.id, member.firmId);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      return client;
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["individual", "company"]),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dateOfBirth: z.string().optional(),
      companyName: z.string().optional(),
      registrationNumber: z.string().optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!["admin", "subadmin", "lawyer"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.type === "individual" && !input.firstName?.trim() && !input.lastName?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "First or last name is required for an individual client",
        });
      }
      if (input.type === "company" && !input.companyName?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Company name is required",
        });
      }
      const result = await createClient({ ...input, firmId: member.firmId, status: "invited" });
      const id = Number((result as { insertId?: number }).insertId ?? 0);
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create client" });
      return { success: true as const, id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dateOfBirth: z.string().optional(),
      companyName: z.string().optional(),
      registrationNumber: z.string().optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["invited", "active", "inactive"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const { id, ...data } = input;
      await updateClient(id, member.firmId, data);
      return { success: true };
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      termsAccepted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.termsAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Terms must be accepted" });
      const member = await requireFirmMember(ctx.user.id);
      await updateClient(input.clientId, member.firmId, {
        termsAcceptedAt: new Date(),
        onboardingCompletedAt: new Date(),
        status: "active",
      });
      return { success: true };
    }),
});
