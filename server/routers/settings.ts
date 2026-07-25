import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getFirmMemberByUserId, getDb } from "../db";
import { agencySettings } from "../../drizzle/schema";

async function requirePlatformOrFirmAdmin(userId: number, role: string) {
  if (role === "superadmin") return;
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  const { getFirmCapabilityMatrix } = await import("../firmPermissions");
  const { canManageFirmSettings } = await import("@shared/roles");
  const { matrix } = await getFirmCapabilityMatrix(member.firmId);
  if (!canManageFirmSettings(member.firmRole, matrix)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const settingsRouter = router({
  // ─── Get All Agency Settings ────────────────────────────────────────────────
  getAll: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformOrFirmAdmin(ctx.user.id, ctx.user.role);

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const settings = await db.select().from(agencySettings);
    const result: Record<string, string> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    return result;
  }),

  // ─── Update Adyen Settings ──────────────────────────────────────────────────
  updateAdyen: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().optional(),
        merchantAccount: z.string().optional(),
        clientKey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformOrFirmAdmin(ctx.user.id, ctx.user.role);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (input.apiKey) {
        await db
          .insert(agencySettings)
          .values({ key: "adyen_api_key", value: input.apiKey })
          .onDuplicateKeyUpdate({ set: { value: input.apiKey } });
      }
      if (input.merchantAccount) {
        await db
          .insert(agencySettings)
          .values({ key: "adyen_merchant_account", value: input.merchantAccount })
          .onDuplicateKeyUpdate({ set: { value: input.merchantAccount } });
      }
      if (input.clientKey) {
        await db
          .insert(agencySettings)
          .values({ key: "adyen_client_key", value: input.clientKey })
          .onDuplicateKeyUpdate({ set: { value: input.clientKey } });
      }

      return { success: true };
    }),

  // ─── Update Agency Logo ─────────────────────────────────────────────────────
  updateLogo: protectedProcedure
    .input(z.object({ logoUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformOrFirmAdmin(ctx.user.id, ctx.user.role);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .insert(agencySettings)
        .values({ key: "logo_url", value: input.logoUrl })
        .onDuplicateKeyUpdate({ set: { value: input.logoUrl } });

      return { success: true };
    }),

  // ─── Update VAT Rates ───────────────────────────────────────────────────────
  updateVatRates: protectedProcedure
    .input(
      z.object({
        standardRate: z.number().min(0).max(100),
        reducedRate: z.number().min(0).max(100),
        specialRate: z.number().min(0).max(100),
        zeroRate: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformOrFirmAdmin(ctx.user.id, ctx.user.role);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const vatRates = JSON.stringify({
        standard: input.standardRate,
        reduced: input.reducedRate,
        special: input.specialRate,
        zero: input.zeroRate,
      });

      await db
        .insert(agencySettings)
        .values({ key: "vat_rates", value: vatRates })
        .onDuplicateKeyUpdate({ set: { value: vatRates } });

      return { success: true };
    }),
});
