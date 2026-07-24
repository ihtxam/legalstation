import {
  getInvoiceByIdOnly,
  getFirmById,
  getClientById,
  getInvoiceItems,
  getCaseById,
} from "./db";
import { renderInvoicePdf, type InvoicePdfData } from "./invoicePdf";

export interface InvoicePdfOptions {
  invoiceId: number;
  firmId?: number;
  includePaymentLink?: boolean;
  paymentUrl?: string;
}

async function fetchLogoDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function clientDisplayName(client: {
  type: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}): string {
  if (client.type === "company") {
    return client.companyName || "Client";
  }
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client";
}

function clientAddressBlock(client: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const lines = [
    client.address,
    [client.postalCode, client.city].filter(Boolean).join(" "),
    client.country,
  ].filter(Boolean);
  return lines.join("\n");
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return 0;
}

/**
 * Load invoice + firm letterhead from DB and render a PDF.
 */
export async function generateInvoicePdfFromDb(options: InvoicePdfOptions): Promise<{
  buffer: Buffer;
  filename: string;
  invoiceNumber: string;
}> {
  const invoice = await getInvoiceByIdOnly(options.invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  if (options.firmId != null && invoice.firmId !== options.firmId) {
    throw new Error("Invoice not found");
  }

  const firm = await getFirmById(invoice.firmId);
  if (!firm) throw new Error("Firm not found");

  const client = await getClientById(invoice.clientId, invoice.firmId);
  if (!client) throw new Error("Client not found");

  const items = await getInvoiceItems(invoice.id);
  const caseRow = invoice.caseId
    ? await getCaseById(invoice.caseId, invoice.firmId)
    : undefined;

  const logoDataUrl = await fetchLogoDataUrl(firm.logoUrl);
  const paymentUrl =
    options.includePaymentLink === false
      ? undefined
      : options.paymentUrl ||
        invoice.adyenPaymentLinkUrl ||
        invoice.stripePaymentUrl ||
        undefined;

  const pdfItems = items.map((item) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    const total = toNumber(item.amount) || quantity * unitPrice;
    return {
      description: item.description,
      quantity,
      unitPrice,
      total,
    };
  });

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: new Date(invoice.issueDate),
    dueDate: new Date(invoice.dueDate),
    firmName: firm.name,
    firmAddress: firm.address || "",
    firmPhone: firm.phone || undefined,
    firmEmail: firm.email || undefined,
    firmVatId: firm.vatNumber || "",
    clientName: clientDisplayName(client),
    clientAddress: clientAddressBlock(client),
    clientEmail: client.email || "",
    caseTitle: caseRow?.title,
    caseReference: caseRow?.referenceNumber || undefined,
    items: pdfItems,
    subtotal: toNumber(invoice.subtotal),
    vatRate: toNumber(invoice.vatRate),
    vatAmount: toNumber(invoice.vatAmount),
    total: toNumber(invoice.total),
    currency: invoice.currency || "CHF",
    notes: invoice.notes || undefined,
    logoDataUrl,
    paymentUrl: paymentUrl || undefined,
  };

  const buffer = await renderInvoicePdf(data);
  return {
    buffer,
    filename: `invoice-${invoice.invoiceNumber}.pdf`,
    invoiceNumber: invoice.invoiceNumber,
  };
}

/** @deprecated Prefer generateInvoicePdfFromDb */
export async function generateInvoicePdf(options: InvoicePdfOptions): Promise<Buffer> {
  const result = await generateInvoicePdfFromDb(options);
  return result.buffer;
}
