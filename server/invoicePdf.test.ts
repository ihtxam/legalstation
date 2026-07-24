import { describe, expect, it } from "vitest";
import { renderInvoicePdf } from "./invoicePdf";

describe("renderInvoicePdf", () => {
  it("generates a PDF buffer with firm letterhead fields", async () => {
    const buffer = await renderInvoicePdf({
      invoiceNumber: "INV-0001",
      issueDate: new Date("2026-01-15"),
      dueDate: new Date("2026-02-15"),
      firmName: "Cabinet Dupont SA",
      firmAddress: "Rue du Rhône 12, 1204 Genève",
      firmPhone: "+41 22 000 00 00",
      firmEmail: "billing@dupont.ch",
      firmVatId: "CHE-123.456.789",
      clientName: "Alice Müller",
      clientAddress: "Bahnhofstrasse 1\n8001 Zürich\nSwitzerland",
      clientEmail: "alice@example.com",
      caseTitle: "Müller v. Example AG",
      caseReference: "C-2026-014",
      items: [
        { description: "Legal consultation", quantity: 2, unitPrice: 350, total: 700 },
        { description: "Court filing fee", quantity: 1, unitPrice: 120, total: 120 },
      ],
      subtotal: 820,
      vatRate: 7.7,
      vatAmount: 63.14,
      total: 883.14,
      currency: "CHF",
      notes: "Payable within 30 days.",
      paymentUrl: "https://pay.example.com/inv-0001",
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    // PDF magic header
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("works without optional logo, case, notes, or payment URL", async () => {
    const buffer = await renderInvoicePdf({
      invoiceNumber: "INV-0002",
      issueDate: new Date("2026-03-01"),
      dueDate: new Date("2026-03-31"),
      firmName: "LexFlow Demo Firm",
      firmAddress: "Zürich",
      firmVatId: "",
      clientName: "Acme GmbH",
      clientAddress: "",
      clientEmail: "ap@acme.ch",
      items: [{ description: "Flat retainer", quantity: 1, unitPrice: 1000, total: 1000 }],
      subtotal: 1000,
      vatRate: 0,
      vatAmount: 0,
      total: 1000,
    });

    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
