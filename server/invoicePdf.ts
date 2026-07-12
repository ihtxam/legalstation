import { jsPDF } from "jspdf";
import { formatCurrency } from "../shared/utils";

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  firmName: string;
  firmAddress: string;
  firmVatId: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  caseTitle: string;
  caseReference: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  logoUrl?: string;
  paymentUrl?: string;
}

/**
 * Generate invoice PDF
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPosition = margin;

  // ─── Header with Logo ───────────────────────────────────────────────────────
  if (data.logoUrl) {
    try {
      doc.addImage(data.logoUrl, "PNG", margin, yPosition, 30, 15);
      yPosition += 20;
    } catch (e) {
      console.warn("Failed to load logo image");
      yPosition += 5;
    }
  }

  // ─── Invoice Title ──────────────────────────────────────────────────────────
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, yPosition);
  yPosition += 12;

  // ─── Invoice Details ────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${data.invoiceNumber}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Issue Date: ${data.issueDate.toLocaleDateString()}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Due Date: ${data.dueDate.toLocaleDateString()}`, margin, yPosition);
  yPosition += 12;

  // ─── Firm & Client Info ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.text("FROM:", margin, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.firmName, margin, yPosition);
  yPosition += 5;
  doc.setFontSize(9);
  doc.text(data.firmAddress, margin, yPosition);
  yPosition += 5;
  doc.text(`VAT ID: ${data.firmVatId}`, margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", margin, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.clientName, margin, yPosition);
  yPosition += 5;
  doc.setFontSize(9);
  doc.text(data.clientAddress, margin, yPosition);
  yPosition += 5;
  doc.text(data.clientEmail, margin, yPosition);
  yPosition += 10;

  // ─── Case Information ───────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CASE INFORMATION:", margin, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Case: ${data.caseTitle}`, margin, yPosition);
  yPosition += 5;
  doc.text(`Reference: ${data.caseReference}`, margin, yPosition);
  yPosition += 12;

  // ─── Items Table ────────────────────────────────────────────────────────────
  const tableTop = yPosition;
  const colWidths = {
    description: contentWidth * 0.5,
    quantity: contentWidth * 0.15,
    unitPrice: contentWidth * 0.175,
    total: contentWidth * 0.175,
  };

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin, tableTop);
  doc.text("Qty", margin + colWidths.description, tableTop);
  doc.text("Unit Price", margin + colWidths.description + colWidths.quantity, tableTop);
  doc.text("Total", margin + colWidths.description + colWidths.quantity + colWidths.unitPrice, tableTop);

  yPosition = tableTop + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Draw items
  data.items.forEach((item) => {
    doc.text(item.description, margin, yPosition);
    doc.text(item.quantity.toString(), margin + colWidths.description, yPosition);
    doc.text(formatCurrency(item.unitPrice), margin + colWidths.description + colWidths.quantity, yPosition);
    doc.text(formatCurrency(item.total), margin + colWidths.description + colWidths.quantity + colWidths.unitPrice, yPosition);
    yPosition += 6;
  });

  yPosition += 6;

  // ─── Totals ─────────────────────────────────────────────────────────────────
  const totalsX = margin + colWidths.description + colWidths.quantity;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Subtotal:", totalsX, yPosition);
  doc.text(formatCurrency(data.subtotal), margin + contentWidth - 30, yPosition, { align: "right" });
  yPosition += 6;

  doc.text(`VAT (${data.vatRate}%):`, totalsX, yPosition);
  doc.text(formatCurrency(data.vatAmount), margin + contentWidth - 30, yPosition, { align: "right" });
  yPosition += 8;

  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, yPosition);
  doc.text(formatCurrency(data.total), margin + contentWidth - 30, yPosition, { align: "right" });
  yPosition += 12;

  // ─── Notes ──────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, yPosition);
    yPosition += 5;
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, margin, yPosition);
    yPosition += splitNotes.length * 5 + 5;
  }

  // ─── Payment Link (QR Code or URL) ──────────────────────────────────────────
  if (data.paymentUrl) {
    yPosition = pageHeight - 30;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Link:", margin, yPosition);
    yPosition += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 255);
    doc.textWithLink(data.paymentUrl, margin, yPosition, { pageNumber: 1 });
    doc.setTextColor(0, 0, 0);
  }

  // ─── Footer ─────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);

  return Buffer.from(doc.output("arraybuffer"));
}
