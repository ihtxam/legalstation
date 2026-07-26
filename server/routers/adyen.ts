import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getFirmMemberByUserId, updateInvoice } from "../db";
import { createAdyenPaymentLink } from "../adyen";
import { agencySettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertInvoiceAccess } from "../access";
import {
  getFirmAdyenConfig,
  getFirmAdyenPublic,
  upsertFirmAdyenAccount,
} from "../firmAdyen";
import { getAppBaseUrl } from "../tenant";

async function requireFirmAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  const { getFirmCapabilityMatrix } = await import("../firmPermissions");
  const { canManageFirmSettings } = await import("@shared/roles");
  const { matrix } = await getFirmCapabilityMatrix(member.firmId);
  if (!canManageFirmSettings(member.firmRole, matrix)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

/** Firm Adyen first; fall back to platform env / agency_settings. */
export async function resolveAdyenConfig(firmId: number) {
  const firm = await getFirmAdyenConfig(firmId);
  if (firm) {
    return {
      source: "firm" as const,
      apiKey: firm.apiKey,
      merchantAccount: firm.merchantAccount,
      environment: firm.environment,
      clientKey: firm.clientKey,
    };
  }

  const apiKey = process.env.ADYEN_API_KEY || "";
  let merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT || "";
  const environment = (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live"
    ? ("live" as const)
    : ("test" as const);

  if (!merchantAccount) {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.key, "adyen_merchant_account"))
        .limit(1);
      merchantAccount = rows[0]?.value || "";
    }
  }

  if (!apiKey || !merchantAccount) {
    return null;
  }

  return {
    source: "platform" as const,
    apiKey,
    merchantAccount,
    environment,
    clientKey: null as string | null,
  };
}

export const adyenRouter = router({
  /** Firm Settings: public Adyen status + webhook URLs (no secrets). */
  getFirmSettings: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmAdmin(ctx.user.id);
    const publicCfg = await getFirmAdyenPublic(member.firmId);
    const base = getAppBaseUrl(ctx.req).replace(/\/$/, "");
    return {
      ...(publicCfg || {
        configured: false as const,
        merchantAccount: "",
        clientKey: null,
        environment: "test" as const,
        isActive: false,
        hasApiKey: false,
        hasHmacKey: false,
        lastWebhookAt: null,
      }),
      webhookUrl: `${base}/api/adyen/webhook/${member.firmId}`,
      webhookUrlShared: `${base}/api/adyen/webhook`,
      webhookHint:
        "In Adyen Customer Area → Developers → Webhooks, add a Standard webhook pointing to the firm webhook URL. Enable AUTHORISATION and paste the HMAC key below.",
    };
  }),

  upsertFirmSettings: protectedProcedure
    .input(
      z.object({
        merchantAccount: z.string().min(1).max(255),
        apiKey: z.string().optional(),
        clientKey: z.string().optional().nullable(),
        hmacKey: z.string().optional().nullable(),
        environment: z.enum(["test", "live"]).default("test"),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const existing = await getFirmAdyenPublic(member.firmId);
      if (!existing?.hasApiKey && !input.apiKey?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "API key is required when configuring Adyen for the first time",
        });
      }
      try {
        await upsertFirmAdyenAccount({
          firmId: member.firmId,
          merchantAccount: input.merchantAccount,
          apiKey: input.apiKey,
          clientKey: input.clientKey,
          hmacKey: input.hmacKey,
          environment: input.environment,
          isActive: input.isActive,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err?.message || "Could not save Adyen settings",
        });
      }
      return { success: true as const };
    }),

  createPaymentLink: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (invoice.status === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      }

      const config = await resolveAdyenConfig(invoice.firmId);
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Adyen is not configured for this firm. Add your Adyen credentials in Settings → Payments.",
        });
      }

      const amount =
        typeof invoice.total === "string"
          ? Math.round(parseFloat(invoice.total) * 100)
          : Math.round(Number(invoice.total) * 100);

      const origin = String(ctx.req.headers.origin || getAppBaseUrl(ctx.req));
      const paymentLink = await createAdyenPaymentLink({
        amount,
        currency: invoice.currency || "CHF",
        reference: `INV-${invoice.id}`,
        description: `Invoice ${invoice.invoiceNumber}`,
        returnUrl: `${origin}/invoices/${invoice.id}?paid=true`,
        merchantAccount: config.merchantAccount,
        apiKey: config.apiKey,
        environment: config.environment,
      });

      await updateInvoice(invoice.id, invoice.firmId, {
        adyenPaymentLinkId: paymentLink.id,
        adyenPaymentLinkUrl: paymentLink.url,
      } as any);

      return {
        paymentUrl: paymentLink.url,
        paymentLinkId: paymentLink.id,
        gateway: config.source,
      };
    }),

  getPaymentLinkStatus: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      return {
        paymentLinkId: invoice.adyenPaymentLinkId,
        paymentLinkUrl: invoice.adyenPaymentLinkUrl,
        status: invoice.status,
      };
    }),
});
