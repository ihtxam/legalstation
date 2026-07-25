import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { generateInvoicePdfFromDb } from "../invoicePdfGenerator";
import {
  getInvoiceByIdOnly,
  getFirmMemberByUserId,
  getClientByUserId,
  getClientById,
} from "../db";
import { emailInvoiceToClient } from "../invoiceEmail";

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
        includedQrBill: result.includedQrBill,
        qrBillSkipReason: result.qrBillSkipReason,
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

      const client = await getClientById(invoice.clientId, invoice.firmId);
      const toEmail = input.recipientEmail || client?.email || undefined;
      if (!toEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client has no email address. Add one or provide recipientEmail.",
        });
      }

      const result = await emailInvoiceToClient({
        invoiceId: input.invoiceId,
        recipientEmail: toEmail,
        includePaymentLink: input.includePaymentLink,
      });
      if (!result.sent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason || "Failed to send invoice" });
      }

      return { success: true as const, message: "Invoice sent successfully", email: result.email };
    }),
});
