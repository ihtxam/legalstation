import { jsPDF } from "jspdf";
import { formatCurrency, formatDateSwiss } from "../shared/utils";

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  firmName: string;
  firmAddress: string;
  firmPhone?: string;
  firmEmail?: string;
  firmVatId: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  caseTitle?: string;
  caseReference?: string;
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
  currency?: string;
  notes?: string;
  /** Data URL or remote URL (remote URLs should be pre-fetched as data URLs) */
  logoDataUrl?: string;
  paymentUrl?: string;
}

/**
 * Render an invoice PDF with firm letterhead.
 * Pure function — no DB access.
 */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const currency = data.currency ?? "CHF";

  let y = margin;

  // ─── Letterhead ────────────────────────────────────────────────────────────
  let textX = margin;
  if (data.logoDataUrl) {
    try {
      const format = data.logoDataUrl.includes("image/jpeg") || data.logoDataUrl.includes("image/jpg")
        ? "JPEG"
        : "PNG";
      doc.addImage(data.logoDataUrl, format, margin, y, 28, 14);
      textX = margin + 34;
    } catch {
      // Logo optional — continue without it
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 31, 63); // navy
  doc.text(data.firmName, textX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const firmLines = [
    data.firmAddress,
    data.firmPhone,
    data.firmEmail,
    data.firmVatId ? `UID/VAT: ${data.firmVatId}` : undefined,
  ].filter(Boolean) as string[];
  firmLines.forEach((line, i) => {
    doc.text(line, textX, y + 11 + i * 4);
  });

  y += Math.max(22, 11 + firmLines.length * 4) + 6;

  // Accent rule
  doc.setDrawColor(184, 148, 58); // gold
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ─── Title + meta ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 31, 63);
  doc.text("INVOICE", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const metaX = pageWidth - margin;
  doc.text(`No. ${data.invoiceNumber}`, metaX, y, { align: "right" });
  doc.text(`Issued: ${formatDateSwiss(data.issueDate)}`, metaX, y + 5, { align: "right" });
  doc.text(`Due: ${formatDateSwiss(data.dueDate)}`, metaX, y + 10, { align: "right" });
  y += 18;

  // ─── Bill to ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("BILL TO", margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(data.clientName, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (data.clientAddress) {
    const addrLines = doc.splitTextToSize(data.clientAddress, contentWidth * 0.5);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 4;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, margin, y);
    y += 4;
  }
  y += 6;

  // ─── Case info ─────────────────────────────────────────────────────────────
  if (data.caseTitle || data.caseReference) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("CASE", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    if (data.caseTitle) {
      doc.text(data.caseTitle, margin, y);
      y += 4;
    }
    if (data.caseReference) {
      doc.text(`Ref: ${data.caseReference}`, margin, y);
      y += 4;
    }
    y += 4;
  }

  // ─── Items table ───────────────────────────────────────────────────────────
  const cols = {
    desc: contentWidth * 0.5,
    qty: contentWidth * 0.12,
    unit: contentWidth * 0.19,
    total: contentWidth * 0.19,
  };

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, contentWidth, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Description", margin + 2, y + 5.5);
  doc.text("Qty", margin + cols.desc + 2, y + 5.5);
  doc.text("Unit", margin + cols.desc + cols.qty + 2, y + 5.5);
  doc.text("Amount", pageWidth - margin - 2, y + 5.5, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const item of data.items) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }
    const descLines = doc.splitTextToSize(item.description, cols.desc - 4);
    doc.text(descLines, margin + 2, y);
    doc.text(String(item.quantity), margin + cols.desc + 2, y);
    doc.text(formatCurrency(item.unitPrice, currency), margin + cols.desc + cols.qty + 2, y);
    doc.text(formatCurrency(item.total, currency), pageWidth - margin - 2, y, { align: "right" });
    y += Math.max(6, descLines.length * 4) + 2;
  }

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin + cols.desc, y, pageWidth - margin, y);
  y += 8;

  // ─── Totals ────────────────────────────────────────────────────────────────
  const totalsX = margin + cols.desc;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", totalsX, y);
  doc.text(formatCurrency(data.subtotal, currency), pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.text(`VAT (${data.vatRate}%)`, totalsX, y);
  doc.text(formatCurrency(data.vatAmount, currency), pageWidth - margin, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 31, 63);
  doc.text("TOTAL", totalsX, y);
  doc.text(formatCurrency(data.total, currency), pageWidth - margin, y, { align: "right" });
  y += 12;
  doc.setTextColor(40, 40, 40);

  // ─── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Notes", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 6;
  }

  // ─── Payment link ──────────────────────────────────────────────────────────
  if (data.paymentUrl) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Pay online:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 70, 160);
    const linkLines = doc.splitTextToSize(data.paymentUrl, contentWidth);
    doc.textWithLink(linkLines[0], margin, y, { url: data.paymentUrl });
    doc.setTextColor(40, 40, 40);
  }

  // ─── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${data.firmName} · Generated ${formatDateSwiss(new Date())} · LexFlow`,
    margin,
    pageHeight - 8
  );

  return Buffer.from(doc.output("arraybuffer"));
}

/** @deprecated Use renderInvoicePdf */
export const generateInvoicePdf = renderInvoicePdf;
