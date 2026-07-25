import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { updateInvoice } from "../db";
import { getStripe } from "../stripe";
import { assertInvoiceAccess } from "../access";

export const stripeRouter = router({
  createPaymentIntent: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(invoice.total) * 100),
        currency: invoice.currency.toLowerCase(),
        metadata: {
          invoiceId: invoice.id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          firmId: invoice.firmId.toString(),
        },
        automatic_payment_methods: { enabled: true },
      });
      await updateInvoice(invoice.id, invoice.firmId, {
        stripePaymentIntentId: paymentIntent.id,
      } as any);
      return { clientSecret: paymentIntent.client_secret };
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      if (invoice.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice cancelled" });
      }
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured (STRIPE_SECRET_KEY)",
        });
      }
      const stripe = getStripe();
      const origin = String(ctx.req.headers.origin || "");
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Invoice ${invoice.invoiceNumber}` },
            unit_amount: Math.round(Number(invoice.total) * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          invoiceId: invoice.id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          firmId: invoice.firmId.toString(),
          user_id: ctx.user.id.toString(),
        },
        success_url: `${origin}/invoices/${invoice.id}?payment=success`,
        cancel_url: `${origin}/invoices/${invoice.id}?payment=cancelled`,
        allow_promotion_codes: true,
      });

      if (session.url) {
        await updateInvoice(invoice.id, invoice.firmId, {
          stripePaymentUrl: session.url,
        } as any);
      }

      return { url: session.url, sessionId: session.id };
    }),
});
