import { generateInvoicePdfFromDb } from "./invoicePdfGenerator";
import { getClientById, getFirmById, getInvoiceByIdOnly, updateInvoice } from "./db";
import { sendEmail } from "./email";

/**
 * Generate the invoice PDF (with Swiss QR page when configured) and email it to the client.
 */
export async function emailInvoiceToClient(opts: {
  invoiceId: number;
  recipientEmail?: string | null;
  includePaymentLink?: boolean;
}): Promise<{ sent: boolean; email?: string; reason?: string }> {
  const invoice = await getInvoiceByIdOnly(opts.invoiceId);
  if (!invoice) return { sent: false, reason: "Invoice not found" };

  const firm = await getFirmById(invoice.firmId);
  const client = await getClientById(invoice.clientId, invoice.firmId);
  const toEmail = (opts.recipientEmail || client?.email || "").trim().toLowerCase();
  if (!toEmail) return { sent: false, reason: "Client has no email address" };

  const result = await generateInvoicePdfFromDb({
    invoiceId: opts.invoiceId,
    firmId: invoice.firmId,
    includePaymentLink: opts.includePaymentLink !== false,
    paymentUrl: invoice.adyenPaymentLinkUrl || invoice.stripePaymentUrl || undefined,
  });

  const paymentUrl = invoice.adyenPaymentLinkUrl || invoice.stripePaymentUrl;
  const currency = invoice.currency || "CHF";

  await sendEmail({
    to: [{ email: toEmail }],
    subject: `Invoice ${invoice.invoiceNumber}${firm ? ` — ${firm.name}` : ""}`,
    htmlContent: `
      <p>Dear Client,</p>
      <p>Please find your invoice <strong>${invoice.invoiceNumber}</strong> attached.</p>
      <p>Amount due: <strong>${currency} ${invoice.total}</strong></p>
      ${
        opts.includePaymentLink !== false && paymentUrl
          ? `<p><a href="${paymentUrl}" style="background-color:#00BFA6;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Pay Now</a></p>`
          : ""
      }
      <p>A Swiss QR-bill payment slip is included on page 2 when your firm banking details are configured.</p>
      <p>Thank you for your business.</p>
    `,
    replyTo: firm?.email ? { email: firm.email, name: firm.name || undefined } : undefined,
    attachment: [
      {
        name: result.filename,
        content: result.buffer.toString("base64"),
      },
    ],
  });

  if (invoice.status === "draft") {
    await updateInvoice(invoice.id, invoice.firmId, { status: "sent" });
  }

  return { sent: true, email: toEmail };
}
