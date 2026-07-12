import { jsPDF } from "jspdf";
import { getDb, getInvoiceById, getFirmById, getClientById } from "./db";
import { invoiceItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface InvoicePdfOptions {
  invoiceId: number;
  firmLogoUrl?: string;
  includePaymentLink?: boolean;
  adyenPaymentUrl?: string;
}

/**
 * Generate invoice PDF with firm letterhead
 */
export async function generateInvoicePdf(options: InvoicePdfOptions): Promise<Buffer> {
  const { invoiceId, firmLogoUrl, includePaymentLink, adyenPaymentUrl } = options;

  // Fetch invoice data
  const invoice = await getInvoiceById(invoiceId, 0) as any;
  if (!invoice) throw new Error("Invoice not found");

  const firm = await getFirmById(invoice.firmId);
  if (!firm) throw new Error("Firm not found");

  const client = await getClientById(invoice.clientId, invoice.firmId);
  if (!client) throw new Error("Client not found");

  // Fetch invoice items
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));

  // Create PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // ─── Header with Firm Logo & Info ───────────────────────────────────────
  if (firmLogoUrl) {
    try {
      pdf.addImage(firmLogoUrl, "PNG", 20, yPosition, 30, 30);
    } catch (e) {
      console.warn("Failed to add firm logo:", e);
    }
  }

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(firm.name, 60, yPosition + 5);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(firm.address || "", 60, yPosition + 12);
  pdf.text(`CHF-${firm.vatNumber || ""}`, 60, yPosition + 18);

  yPosition += 45;

  // ─── Invoice Title & Number ─────────────────────────────────────────────
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("INVOICE", 20, yPosition);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Invoice #: ${invoice.invoiceNumber}`, 20, yPosition + 10);
  pdf.text(
    `Date: ${new Date(invoice.issueDate).toLocaleDateString("de-CH")}`,
    20,
    yPosition + 16
  );
  pdf.text(
    `Due: ${new Date(invoice.dueDate).toLocaleDateString("de-CH")}`,
    20,
    yPosition + 22
  );

  yPosition += 35;

  // ─── Bill To ────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.text("BILL TO:", 20, yPosition);

  pdf.setFont("helvetica", "normal");
  yPosition += 7;

  if (client.type === "individual") {
    pdf.text(`${client.firstName} ${client.lastName}`, 20, yPosition);
  } else {
    pdf.text(client.companyName || "", 20, yPosition);
  }

  yPosition += 6;
  if (client.email) pdf.text(client.email, 20, yPosition);
  yPosition += 6;
  if (client.phone) pdf.text(client.phone, 20, yPosition);

  yPosition += 15;

  // ─── Items Table ────────────────────────────────────────────────────────
  const tableTop = yPosition;
  const colWidths = [80, 25, 25, 30];
  const cols = ["Description", "Qty", "Unit Price", "Amount"];

  // Header
  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(240, 240, 240);
  let xPos = 20;
  cols.forEach((col, i) => {
    pdf.rect(xPos, tableTop, colWidths[i], 8, "F");
    pdf.text(col, xPos + 2, tableTop + 6);
    xPos += colWidths[i];
  });

  // Items
  pdf.setFont("helvetica", "normal");
  let itemY = tableTop + 10;
  items.forEach((item) => {
    const qty = typeof item.quantity === "string" ? parseFloat(item.quantity) : (item.quantity || 1);
    const unitPrice = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice;
    const amount = qty * unitPrice;
    xPos = 20;

    pdf.text(item.description, xPos + 2, itemY);
    xPos += colWidths[0];

    pdf.text(String(qty), xPos + 2, itemY);
    xPos += colWidths[1];

    pdf.text(`CHF ${unitPrice.toFixed(2)}`, xPos + 2, itemY);
    xPos += colWidths[2];

    pdf.text(`CHF ${amount.toFixed(2)}`, xPos + 2, itemY);

    itemY += 8;
  });

  yPosition = itemY + 10;

  // ─── Totals ─────────────────────────────────────────────────────────────
  const subtotal = typeof invoice.subtotal === "string" ? parseFloat(invoice.subtotal) : invoice.subtotal;
  const vatAmount = typeof invoice.vatAmount === "string" ? parseFloat(invoice.vatAmount) : invoice.vatAmount;
  const total = typeof invoice.total === "string" ? parseFloat(invoice.total) : invoice.total;
  const vatRate = typeof invoice.vatRate === "string" ? parseFloat(invoice.vatRate) : invoice.vatRate;

  pdf.setFont("helvetica", "normal");
  const rightCol = pageWidth - 60;

  pdf.text("Subtotal:", rightCol - 30, yPosition);
  pdf.text(`CHF ${subtotal.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 8;
  pdf.text(`VAT (${vatRate.toFixed(1)}%):`, rightCol - 30, yPosition);
  pdf.text(`CHF ${vatAmount.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 10;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("TOTAL:", rightCol - 30, yPosition);
  pdf.text(`CHF ${total.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 20;

  // ─── Payment Link (if provided) ──────────────────────────────────────────
  if (includePaymentLink && adyenPaymentUrl) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("PAYMENT LINK:", 20, yPosition);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 255);
    pdf.textWithLink(adyenPaymentUrl, 20, yPosition + 7, { pageNumber: 1 });
    pdf.setTextColor(0, 0, 0);

    yPosition += 15;
  }

  // ─── Notes ──────────────────────────────────────────────────────────────
  if (invoice.notes) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("NOTES:", 20, yPosition);

    pdf.setFont("helvetica", "normal");
    const noteLines = pdf.splitTextToSize(invoice.notes, pageWidth - 40);
    pdf.text(noteLines, 20, yPosition + 7);
  }

  // ─── Footer ─────────────────────────────────────────────────────────────
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Generated on ${new Date().toLocaleDateString("de-CH")} | LexFlow Invoice System`,
    20,
    pageHeight - 10
  );

  return Buffer.from(pdf.output("arraybuffer"));
}
