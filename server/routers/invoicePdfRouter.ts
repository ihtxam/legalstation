import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { generateInvoicePdf } from "../invoicePdfGenerator";
import { getInvoiceByIdOnly, getFirmMemberByUserId, getClientByUserId } from "../db";
import { sendEmail } from "../email";

async function assertInvoiceAccess(userId: number, invoiceId: number) {
  const invoice = await getInvoiceByIdOnly(invoiceId);
  if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

  const member = await getFirmMemberByUserId(userId);
  if (member && member.firmId === invoice.firmId) {
    return { invoice, member, client: undefined as Awaited<ReturnType<typeof getClientByUserId>> };
  }

  const client = await getClientByUserId(userId);
  if (client && client.id === invoice.clientId) {
    return { invoice, member: undefined as Awaited<ReturnType<typeof getFirmMemberByUserId>>, client };
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this invoice" });
}

export const invoicePdfRouter = router({
  /**
   * Generate invoice PDF with firm letterhead
   */
  generate: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      includePaymentLink: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);

      const pdfBuffer = await generateInvoicePdf({
        invoiceId: input.invoiceId,
        includePaymentLink: input.includePaymentLink,
        adyenPaymentUrl: invoice.adyenPaymentLinkUrl || undefined,
      });

      return {
        success: true,
        buffer: pdfBuffer.toString("base64"),
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
      };
    }),

  /**
   * Send invoice PDF via email
   */
  sendEmail: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      recipientEmail: z.string().email(),
      includePaymentLink: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invoice, member } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only firm members can email invoices" });
      }

      const pdfBuffer = await generateInvoicePdf({
        invoiceId: input.invoiceId,
        includePaymentLink: input.includePaymentLink,
        adyenPaymentUrl: invoice.adyenPaymentLinkUrl || undefined,
      });

      await sendEmail({
        to: [{ email: input.recipientEmail }],
        subject: `Invoice ${invoice.invoiceNumber}`,
        htmlContent: `
          <p>Dear Client,</p>
          <p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached.</p>
          <p>Amount due: <strong>CHF ${invoice.total}</strong></p>
          ${input.includePaymentLink && invoice.adyenPaymentLinkUrl ? `
            <p><a href="${invoice.adyenPaymentLinkUrl}" style="background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Pay Now</a></p>
          ` : ""}
          <p>Thank you for your business.</p>
        `,
        sender: { email: "invoices@lexflow.app", name: "LexFlow Invoices" },
        attachment: [{
          name: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        }],
      });

      return { success: true, message: "Invoice sent successfully" };
    }),
});
