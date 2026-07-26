import { jsPDF } from "jspdf";
import { getDb, getInvoiceByIdOnly, getFirmById, getClientById } from "./db";
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

  const invoice = await getInvoiceByIdOnly(invoiceId);
  if (!invoice) throw new Error("Invoice not found");

  const firm = await getFirmById(invoice.firmId);
  if (!firm) throw new Error("Firm not found");

  const client = await getClientById(invoice.clientId, invoice.firmId);
  if (!client) throw new Error("Client not found");

  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  const logoUrl = firmLogoUrl || firm.logoUrl || undefined;
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const format = contentType.includes("jpeg") || contentType.includes("jpg")
          ? "JPEG"
          : contentType.includes("webp")
            ? "WEBP"
            : "PNG";
        const dataUri = `data:${contentType || "image/png"};base64,${base64}`;
        pdf.addImage(dataUri, format, 20, yPosition, 28, 28);
      }
    } catch (e) {
      console.warn("Failed to add firm logo:", e);
    }
  }

  const textX = logoUrl ? 55 : 20;
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 31, 63); // navy
  pdf.text(firm.name, textX, yPosition + 6);

  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  let headerY = yPosition + 12;
  if (firm.address) {
    const addressLines = pdf.splitTextToSize(firm.address, 90);
    pdf.text(addressLines, textX, headerY);
    headerY += addressLines.length * 4;
  }
  if (firm.phone) {
    pdf.text(firm.phone, textX, headerY);
    headerY += 4;
  }
  if (firm.email) {
    pdf.text(firm.email, textX, headerY);
    headerY += 4;
  }
  if (firm.vatNumber) {
    pdf.text(`UID/VAT: ${firm.vatNumber}`, textX, headerY);
  }

  // Gold accent line under letterhead
  yPosition = Math.max(yPosition + 40, headerY + 8);
  pdf.setDrawColor(184, 148, 74);
  pdf.setLineWidth(0.6);
  pdf.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 12;

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("INVOICE", 20, yPosition);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Invoice #: ${invoice.invoiceNumber}`, 20, yPosition + 10);
  pdf.text(
    `Date: ${new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString("de-CH")}`,
    20,
    yPosition + 16
  );
  if (invoice.dueDate) {
    pdf.text(
      `Due: ${new Date(invoice.dueDate).toLocaleDateString("de-CH")}`,
      20,
      yPosition + 22
    );
  }

  yPosition += 35;

  pdf.setFont("helvetica", "bold");
  pdf.text("BILL TO:", 20, yPosition);

  pdf.setFont("helvetica", "normal");
  yPosition += 7;

  if (client.type === "individual") {
    pdf.text(`${client.firstName || ""} ${client.lastName || ""}`.trim(), 20, yPosition);
  } else {
    pdf.text(client.companyName || "", 20, yPosition);
  }

  yPosition += 6;
  if (client.email) pdf.text(client.email, 20, yPosition);
  yPosition += 6;
  if (client.phone) pdf.text(client.phone, 20, yPosition);

  yPosition += 15;

  const tableTop = yPosition;
  const colWidths = [80, 25, 30, 35];
  const cols = ["Description", "Qty", "Unit Price", "Amount"];

  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(240, 240, 240);
  let xPos = 20;
  cols.forEach((col, i) => {
    pdf.rect(xPos, tableTop, colWidths[i], 8, "F");
    pdf.text(col, xPos + 2, tableTop + 6);
    xPos += colWidths[i];
  });

  pdf.setFont("helvetica", "normal");
  let itemY = tableTop + 10;
  items.forEach((item) => {
    const qty = typeof item.quantity === "string" ? parseFloat(item.quantity) : (item.quantity || 1);
    const unitPrice = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : Number(item.unitPrice);
    const amount = qty * unitPrice;
    xPos = 20;

    const descLines = pdf.splitTextToSize(item.description, colWidths[0] - 4);
    pdf.text(descLines, xPos + 2, itemY);
    xPos += colWidths[0];

    pdf.text(String(qty), xPos + 2, itemY);
    xPos += colWidths[1];

    pdf.text(`CHF ${unitPrice.toFixed(2)}`, xPos + 2, itemY);
    xPos += colWidths[2];

    pdf.text(`CHF ${amount.toFixed(2)}`, xPos + 2, itemY);

    itemY += Math.max(8, descLines.length * 5);
  });

  yPosition = itemY + 10;

  const subtotal = typeof invoice.subtotal === "string" ? parseFloat(invoice.subtotal) : Number(invoice.subtotal);
  const vatAmount = typeof invoice.vatAmount === "string" ? parseFloat(invoice.vatAmount) : Number(invoice.vatAmount);
  const total = typeof invoice.total === "string" ? parseFloat(invoice.total) : Number(invoice.total);
  const vatRate = typeof invoice.vatRate === "string" ? parseFloat(invoice.vatRate) : Number(invoice.vatRate);

  pdf.setFont("helvetica", "normal");
  const rightCol = pageWidth - 25;

  pdf.text("Subtotal:", rightCol - 55, yPosition);
  pdf.text(`CHF ${subtotal.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 8;
  pdf.text(`VAT (${vatRate.toFixed(1)}%):`, rightCol - 55, yPosition);
  pdf.text(`CHF ${vatAmount.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 10;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("TOTAL:", rightCol - 55, yPosition);
  pdf.text(`CHF ${total.toFixed(2)}`, rightCol, yPosition, { align: "right" });

  yPosition += 20;

  if (includePaymentLink && adyenPaymentUrl) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("PAYMENT LINK:", 20, yPosition);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 255);
    pdf.textWithLink(adyenPaymentUrl, 20, yPosition + 7, { url: adyenPaymentUrl });
    pdf.setTextColor(0, 0, 0);

    yPosition += 15;
  }

  if (invoice.notes) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("NOTES:", 20, yPosition);

    pdf.setFont("helvetica", "normal");
    const noteLines = pdf.splitTextToSize(invoice.notes, pageWidth - 40);
    pdf.text(noteLines, 20, yPosition + 7);
  }

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `${firm.name} · Generated ${new Date().toLocaleDateString("de-CH")} · LexFlow`,
    20,
    pageHeight - 10
  );

  return Buffer.from(pdf.output("arraybuffer"));
}
