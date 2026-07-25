import { describe, expect, it } from "vitest";
import {
  buildQrReference,
  buildScorReference,
  buildSwissQrBillData,
  canRenderSwissQrBill,
  getSwissQrBillSkipReason,
  renderSwissQrBillPdf,
  mergePdfBuffers,
  toPdfSafeText,
} from "./swissQrBill";
import { renderInvoicePdf } from "./invoicePdf";
import { isQRReferenceValid, isSCORReferenceValid, isQRIBAN } from "swissqrbill/utils";

describe("swissQrBill helpers", () => {
  it("builds a valid QR reference", () => {
    const ref = buildQrReference(42, "INV-2026-001");
    expect(ref).toHaveLength(27);
    expect(isQRReferenceValid(ref)).toBe(true);
  });

  it("builds a valid SCOR reference", () => {
    const ref = buildScorReference("INV-2026-001");
    expect(ref.startsWith("RF")).toBe(true);
    expect(isSCORReferenceValid(ref)).toBe(true);
  });

  it("detects when banking is configured", () => {
    expect(canRenderSwissQrBill({ name: "Firm", iban: "CH9300762011623852957" })).toBe(true);
    expect(canRenderSwissQrBill({ name: "Firm" })).toBe(false);
  });

  it("reports skip reasons for missing/invalid Swiss IBANs", () => {
    expect(getSwissQrBillSkipReason({ name: "Firm" })).toBe("missing_iban");
    // Truncated / mistyped IBAN (20 chars) — common data-entry error
    expect(getSwissQrBillSkipReason({ name: "Firm", iban: "CH363000529014470701" })).toBe(
      "invalid_iban"
    );
    expect(getSwissQrBillSkipReason({ name: "Firm", qrIban: "CH363000529014470701" })).toBe(
      "invalid_qr_iban"
    );
    expect(getSwissQrBillSkipReason({ name: "Firm", iban: "CH9300762011623852957" })).toBeNull();
  });

  it("sanitizes accented text for Helvetica PDF fonts", () => {
    expect(toPdfSafeText("Neuchâtel")).toBe("Neuchatel");
    expect(toPdfSafeText("Genève")).toBe("Geneve");
  });

  it("builds QR-bill data with QR-IBAN + QR reference", () => {
    const data = buildSwissQrBillData({
      firm: {
        name: "Cabinet Dupont SA",
        qrIban: "CH4431999123000889012",
        street: "Rue du Rhône",
        buildingNumber: "12",
        postalCode: "1204",
        city: "Genève",
        country: "CH",
      },
      debtor: {
        name: "Alice Müller",
        address: "Bahnhofstrasse 1",
        postalCode: "8001",
        city: "Zürich",
        country: "CH",
      },
      amount: 883.14,
      currency: "CHF",
      invoiceId: 7,
      invoiceNumber: "INV-0007",
    });
    expect(data).not.toBeNull();
    expect(isQRIBAN(data!.creditor.account)).toBe(true);
    expect(data!.reference).toBeTruthy();
    expect(isQRReferenceValid(data!.reference!)).toBe(true);
  });

  it("renders a QR-bill PDF page and merges it as invoice page 2", async () => {
    const data = buildSwissQrBillData({
      firm: {
        name: "Cabinet Dupont SA",
        iban: "CH9300762011623852957",
        street: "Rue du Rhône",
        buildingNumber: "12",
        postalCode: "1204",
        city: "Genève",
        country: "CH",
      },
      debtor: {
        name: "Alice Müller",
        address: "Bahnhofstrasse 1",
        postalCode: "8001",
        city: "Zürich",
        country: "CH",
      },
      amount: 100,
      invoiceId: 1,
      invoiceNumber: "INV-1",
    });
    expect(data).not.toBeNull();

    const invoicePdf = await renderInvoicePdf({
      invoiceNumber: "INV-1",
      issueDate: new Date("2026-01-15"),
      dueDate: new Date("2026-02-15"),
      firmName: "Cabinet Dupont SA",
      firmAddress: "Rue du Rhône 12, 1204 Genève",
      firmVatId: "CHE-123.456.789",
      clientName: "Alice Müller",
      clientAddress: "Bahnhofstrasse 1\n8001 Zürich",
      clientEmail: "alice@example.com",
      items: [{ description: "Advice", quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100,
      vatRate: 0,
      vatAmount: 0,
      total: 100,
    });

    const qrPdf = await renderSwissQrBillPdf(data!);
    const merged = await mergePdfBuffers(invoicePdf, qrPdf);
    expect(merged.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(merged.length).toBeGreaterThan(invoicePdf.length);
  }, 20000);
});
