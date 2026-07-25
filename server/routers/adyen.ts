import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, updateInvoice } from "../db";
import { createAdyenPaymentLink } from "../adyen";
import { agencySettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertInvoiceAccess } from "../access";

async function getAdyenConfig() {
  const apiKey = process.env.ADYEN_API_KEY || "";
  const merchantFromEnv = process.env.ADYEN_MERCHANT_ACCOUNT || "";
  const environment = (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase();

  let merchantAccount = merchantFromEnv;
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
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Adyen not configured (ADYEN_API_KEY + ADYEN_MERCHANT_ACCOUNT)",
    });
  }

  return { apiKey, merchantAccount, environment };
}

export const adyenRouter = router({
  createPaymentLink: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (invoice.status === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      }

      const { apiKey, merchantAccount, environment } = await getAdyenConfig();
      const amount =
        typeof invoice.total === "string"
          ? Math.round(parseFloat(invoice.total) * 100)
          : Math.round(Number(invoice.total) * 100);

      const paymentLink = await createAdyenPaymentLink({
        amount,
        currency: invoice.currency || "CHF",
        reference: `INV-${invoice.id}`,
        description: `Invoice ${invoice.invoiceNumber}`,
        returnUrl: `${ctx.req.headers.origin || "https://lexflow.app"}/invoices/${invoice.id}?paid=true`,
        merchantAccount,
        apiKey,
        environment: environment === "live" ? "live" : "test",
      });

      await updateInvoice(invoice.id, invoice.firmId, {
        adyenPaymentLinkId: paymentLink.id,
        adyenPaymentLinkUrl: paymentLink.url,
      } as any);

      return {
        paymentUrl: paymentLink.url,
        paymentLinkId: paymentLink.id,
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
