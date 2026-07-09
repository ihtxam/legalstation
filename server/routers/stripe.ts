import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getFirmMemberByUserId, getInvoiceById, updateInvoice } from "../db";
import { getStripe } from "../stripe";

export const stripeRouter = router({
  createPaymentIntent: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      const invoice = await getInvoiceById(input.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(Number(invoice.total) * 100),
        currency: invoice.currency.toLowerCase(),
        metadata: {
          invoiceId: invoice.id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          firmId: member.firmId.toString(),
        },
        automatic_payment_methods: { enabled: true },
      });
      await updateInvoice(invoice.id, member.firmId, {
        stripePaymentIntentId: paymentIntent.id,
      } as any);
      return { clientSecret: paymentIntent.client_secret };
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      const invoice = await getInvoiceById(input.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
      const stripe = getStripe();
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
          firmId: member.firmId.toString(),
          user_id: ctx.user.id.toString(),
        },
        success_url: `${ctx.req.headers.origin}/invoices/${invoice.id}?payment=success`,
        cancel_url: `${ctx.req.headers.origin}/invoices/${invoice.id}?payment=cancelled`,
        allow_promotion_codes: true,
      });
      return { url: session.url };
    }),
});

