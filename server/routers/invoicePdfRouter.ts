import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { generateInvoicePdf } from "../invoicePdfGenerator";
import { getInvoiceById, getFirmMemberByUserId, getClientByUserId } from "../db";
import { sendEmail } from "../email";

export const invoicePdfRouter = router({
  /**
   * Generate invoice PDF
   */
  generate: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      includePaymentLink: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await getInvoiceById(input.invoiceId, 0);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      // Check access: lawyer/admin or client
      const member = await getFirmMemberByUserId(ctx.user.id);
      const client = await getClientByUserId(ctx.user.id);

      if (member && member.firmId === invoice.firmId) {
        // Lawyer/admin can generate
      } else if (client && client.id === invoice.clientId) {
        // Client can generate their own
      } else {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Generate PDF
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
      const invoice = await getInvoiceById(input.invoiceId, 0);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

      // Check access: only lawyer/admin can send
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || member.firmId !== invoice.firmId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Generate PDF
      const pdfBuffer = await generateInvoicePdf({
        invoiceId: input.invoiceId,
        includePaymentLink: input.includePaymentLink,
        adyenPaymentUrl: invoice.adyenPaymentLinkUrl || undefined,
      });

      // Send email with payment link
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
      });

      return { success: true, message: "Invoice sent successfully" };
    }),
});
