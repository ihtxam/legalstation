import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getInvoiceById } from "../db";
import { createAdyenPaymentLink } from "../adyen";
import { invoices, agencySettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const adyenRouter = router({
  // ─── Create Payment Link for Invoice ────────────────────────────────────────
  createPaymentLink: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get invoice
      const invoice = await getInvoiceById(input.invoiceId, 0);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      // Get Adyen settings
      const adyenSettings = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.key, "adyen_merchant_account"));

      if (!adyenSettings.length) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adyen not configured" });
      }

      // Create payment link
      const amount = typeof invoice.total === 'string' 
        ? Math.round(parseFloat(invoice.total) * 100) 
        : Math.round(invoice.total * 100);

      const paymentLink = await createAdyenPaymentLink({
        amount,
        currency: invoice.currency || "CHF",
        reference: `INV-${invoice.id}`,
        description: `Invoice ${invoice.invoiceNumber}`,
        returnUrl: `${ctx.req.headers.origin || 'https://lexflow.app'}/invoices/${invoice.id}?paid=true`,
        merchantAccount: adyenSettings[0].value,
        apiKey: "", // Will be set from env in production
      });

      // Store payment link in database
      await db
        .update(invoices)
        .set({
          adyenPaymentLinkId: paymentLink.id,
          adyenPaymentLinkUrl: paymentLink.url,
        })
        .where(eq(invoices.id, input.invoiceId));

      return {
        paymentUrl: paymentLink.url,
        paymentLinkId: paymentLink.id,
      };
    }),

  // ─── Get Payment Link Status ────────────────────────────────────────────────
  getPaymentLinkStatus: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await getInvoiceById(input.invoiceId, 0);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        paymentLinkId: invoice.adyenPaymentLinkId,
        paymentLinkUrl: invoice.adyenPaymentLinkUrl,
        status: invoice.status,
      };
    }),
});
