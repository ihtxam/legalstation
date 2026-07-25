import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data } from "swissqrbill/types";
import {
  calculateQRReferenceChecksum,
  calculateSCORReferenceChecksum,
  isIBANValid,
  isQRIBAN,
} from "swissqrbill/utils";

export type FirmQrCreditor = {
  name: string;
  iban?: string | null;
  qrIban?: string | null;
  street?: string | null;
  buildingNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  /** Free-text fallback when structured street/city are missing */
  addressFallback?: string | null;
};

export type DebtorQrInfo = {
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

function cleanIban(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  return cleaned.length >= 15 ? cleaned : null;
}

function parseFallbackStreet(address?: string | null): {
  street: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
} {
  const raw = (address || "").trim();
  if (!raw) return { street: "—" };

  const lines = raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  const first = lines[0] || "—";
  const streetMatch = first.match(/^(.*?)[,\s]+(\d+\w*)$/);
  const street = streetMatch ? streetMatch[1].trim() : first;
  const buildingNumber = streetMatch ? streetMatch[2] : undefined;

  let postalCode: string | undefined;
  let city: string | undefined;
  for (const line of lines.slice(1)) {
    const m = line.match(/^(\d{4})\s+(.+)$/);
    if (m) {
      postalCode = m[1];
      city = m[2];
      break;
    }
  }

  return { street: street.slice(0, 70) || "—", buildingNumber, postalCode, city };
}

/** Build a 27-digit QR reference from invoice identity. */
export function buildQrReference(invoiceId: number, invoiceNumber: string): string {
  const digits = `${String(invoiceId).padStart(12, "0")}${invoiceNumber.replace(/\D/g, "")}000000000000`.replace(
    /\D/g,
    ""
  );
  const ref26 = digits.slice(0, 26).padStart(26, "0");
  return `${ref26}${calculateQRReferenceChecksum(ref26)}`;
}

/** Build an ISO 11649 SCOR reference for a normal IBAN. */
export function buildScorReference(invoiceNumber: string): string {
  const raw = (invoiceNumber.replace(/[^A-Za-z0-9]/g, "") || "INV").slice(0, 21);
  return `RF${calculateSCORReferenceChecksum(raw)}${raw}`;
}

export function resolveCreditorAccount(firm: FirmQrCreditor): string | null {
  const qr = cleanIban(firm.qrIban);
  if (qr && isIBANValid(qr)) return qr;
  const iban = cleanIban(firm.iban);
  if (iban && isIBANValid(iban)) return iban;
  return null;
}

export function canRenderSwissQrBill(firm: FirmQrCreditor): boolean {
  return Boolean(resolveCreditorAccount(firm));
}

export function buildSwissQrBillData(opts: {
  firm: FirmQrCreditor;
  debtor: DebtorQrInfo;
  amount: number;
  currency?: string;
  invoiceId: number;
  invoiceNumber: string;
  message?: string;
}): Data | null {
  const account = resolveCreditorAccount(opts.firm);
  if (!account) return null;

  const fallback = parseFallbackStreet(opts.firm.addressFallback);
  const street = (opts.firm.street || fallback.street || "—").slice(0, 70);
  const buildingNumber = opts.firm.buildingNumber || fallback.buildingNumber;
  const zip = opts.firm.postalCode || fallback.postalCode || "0000";
  const city = (opts.firm.city || fallback.city || "—").slice(0, 35);
  const country = (opts.firm.country || "CH").slice(0, 2).toUpperCase();

  const reference = isQRIBAN(account)
    ? buildQrReference(opts.invoiceId, opts.invoiceNumber)
    : buildScorReference(opts.invoiceNumber);

  const debtorStreet = (opts.debtor.address || "—").slice(0, 70);
  const debtorZip = opts.debtor.postalCode || "0000";
  const debtorCity = (opts.debtor.city || "—").slice(0, 35);
  const debtorCountry = (opts.debtor.country || "CH").slice(0, 2).toUpperCase();

  const currency = (opts.currency || "CHF").toUpperCase() === "EUR" ? "EUR" : "CHF";

  return {
    amount: Math.round(opts.amount * 100) / 100,
    currency,
    reference,
    message: (opts.message || `Invoice ${opts.invoiceNumber}`).slice(0, 140),
    creditor: {
      account,
      name: opts.firm.name.slice(0, 70),
      address: street,
      buildingNumber: buildingNumber || undefined,
      zip,
      city,
      country,
    },
    debtor: {
      name: opts.debtor.name.slice(0, 70),
      address: debtorStreet,
      zip: debtorZip,
      city: debtorCity,
      country: debtorCountry,
    },
  };
}

export async function renderSwissQrBillPdf(
  data: Data,
  language: "DE" | "EN" | "FR" | "IT" | "RM" = "EN"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bill = new SwissQRBill(data, { language, scissors: true, outlines: true });
    bill.attachTo(doc);
    doc.end();
  });
}

export async function mergePdfBuffers(basePdf: Buffer, appendPdf: Buffer): Promise<Buffer> {
  const base = await PdfLibDocument.load(basePdf);
  const append = await PdfLibDocument.load(appendPdf);
  const pages = await base.copyPages(append, append.getPageIndices());
  for (const page of pages) base.addPage(page);
  return Buffer.from(await base.save());
}

/**
 * Append a Swiss QR-bill page when the firm has a valid IBAN / QR-IBAN configured.
 * Returns the original PDF unchanged when banking data is incomplete.
 */
export async function appendSwissQrBillPage(
  invoicePdf: Buffer,
  opts: {
    firm: FirmQrCreditor;
    debtor: DebtorQrInfo;
    amount: number;
    currency?: string;
    invoiceId: number;
    invoiceNumber: string;
    language?: "DE" | "EN" | "FR" | "IT" | "RM";
  }
): Promise<{ buffer: Buffer; includedQrBill: boolean }> {
  const data = buildSwissQrBillData(opts);
  if (!data) return { buffer: invoicePdf, includedQrBill: false };

  try {
    const qrPdf = await renderSwissQrBillPdf(data, opts.language || "EN");
    const merged = await mergePdfBuffers(invoicePdf, qrPdf);
    return { buffer: merged, includedQrBill: true };
  } catch (err) {
    console.error("[SwissQR] Failed to append QR-bill page:", err);
    return { buffer: invoicePdf, includedQrBill: false };
  }
}
