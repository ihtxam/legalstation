import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { generateInvoicePdfFromDb } from "../invoicePdfGenerator";
import {
  getInvoiceByIdOnly,
  getFirmMemberByUserId,
  getClientByUserId,
  getFirmById,
} from "../db";
import { sendEmail } from "../email";

async function assertInvoiceAccess(userId: number, invoiceId: number) {
  const invoice = await getInvoiceByIdOnly(invoiceId);
  if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

  const member = await getFirmMemberByUserId(userId);
  if (member && member.firmId === invoice.firmId) {
    return { invoice, member, client: undefined };
  }

  const client = await getClientByUserId(userId);
  if (client && client.id === invoice.clientId) {
    return { invoice, member: undefined, client };
  }

  throw new TRPCError({ code: "FORBIDDEN" });
}

export const invoicePdfRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        includePaymentLink: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { invoice } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);

      const result = await generateInvoicePdfFromDb({
        invoiceId: input.invoiceId,
        firmId: invoice.firmId,
        includePaymentLink: input.includePaymentLink,
        paymentUrl: invoice.adyenPaymentLinkUrl || invoice.stripePaymentUrl || undefined,
      });

      return {
        success: true as const,
        buffer: result.buffer.toString("base64"),
        filename: result.filename,
        mimeType: "application/pdf",
      };
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        recipientEmail: z.string().email().optional(),
        includePaymentLink: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { invoice, member } = await assertInvoiceAccess(ctx.user.id, input.invoiceId);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only firm members can email invoices" });
      }

      const firm = await getFirmById(invoice.firmId);
      const result = await generateInvoicePdfFromDb({
        invoiceId: input.invoiceId,
        firmId: invoice.firmId,
        includePaymentLink: input.includePaymentLink,
        paymentUrl: invoice.adyenPaymentLinkUrl || invoice.stripePaymentUrl || undefined,
      });

      const toEmail = input.recipientEmail;
      if (!toEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "recipientEmail is required" });
      }

      const paymentUrl = invoice.adyenPaymentLinkUrl || invoice.stripePaymentUrl;
      await sendEmail({
        to: [{ email: toEmail }],
        subject: `Invoice ${invoice.invoiceNumber}${firm ? ` — ${firm.name}` : ""}`,
        htmlContent: `
          <p>Dear Client,</p>
          <p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached.</p>
          <p>Amount due: <strong>CHF ${invoice.total}</strong></p>
          ${
            input.includePaymentLink && paymentUrl
              ? `<p><a href="${paymentUrl}" style="background-color:#001f3f;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Pay Now</a></p>`
              : ""
          }
          <p>Thank you for your business.</p>
        `,
        // Brevo requires a verified sender; use EMAIL_FROM and reply to the firm
        replyTo: firm?.email
          ? { email: firm.email, name: firm.name || undefined }
          : undefined,
        attachment: [
          {
            name: result.filename,
            content: result.buffer.toString("base64"),
          },
        ],
      });

      return { success: true as const, message: "Invoice sent successfully" };
    }),
});
