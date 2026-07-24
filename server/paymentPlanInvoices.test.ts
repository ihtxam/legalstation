import { describe, expect, it } from "vitest";
import {
  computeInstallmentInvoiceAmounts,
  isInstallmentDue,
} from "./paymentPlanInvoices";

describe("payment plan invoice helpers", () => {
  it("treats installment amount as VAT-inclusive total", () => {
    const result = computeInstallmentInvoiceAmounts({
      installmentAmount: 107.7,
      parentVatRate: 7.7,
    });
    expect(result.total).toBe(107.7);
    expect(result.subtotal).toBe(100);
    expect(result.vatAmount).toBe(7.7);
  });

  it("handles zero VAT", () => {
    const result = computeInstallmentInvoiceAmounts({
      installmentAmount: 250,
      parentVatRate: 0,
    });
    expect(result).toEqual({ subtotal: 250, vatAmount: 0, total: 250 });
  });

  it("detects due installments", () => {
    const now = new Date("2026-07-24T12:00:00Z");
    expect(isInstallmentDue(new Date("2026-07-24T11:00:00Z"), now)).toBe(true);
    expect(isInstallmentDue(new Date("2026-07-25T00:00:00Z"), now)).toBe(false);
  });
});
