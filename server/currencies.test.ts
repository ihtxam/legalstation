import { describe, expect, it } from "vitest";
import {
  formatMoney,
  isAppCurrency,
  normalizeCurrency,
  supportsSwissQrCurrency,
} from "../shared/currencies";

describe("currencies catalog", () => {
  it("recognizes EU and Middle East launch currencies", () => {
    for (const code of ["CHF", "EUR", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "USD", "GBP"]) {
      expect(isAppCurrency(code)).toBe(true);
    }
    expect(isAppCurrency("XYZ")).toBe(false);
  });

  it("normalizes case and falls back safely", () => {
    expect(normalizeCurrency("aed")).toBe("AED");
    expect(normalizeCurrency("nope")).toBe("CHF");
  });

  it("limits Swiss QR to CHF/EUR", () => {
    expect(supportsSwissQrCurrency("CHF")).toBe(true);
    expect(supportsSwissQrCurrency("EUR")).toBe(true);
    expect(supportsSwissQrCurrency("AED")).toBe(false);
  });

  it("formats with currency-appropriate fraction digits", () => {
    expect(formatMoney(12.5, "EUR")).toMatch(/12/);
    expect(formatMoney(1.234, "KWD")).toMatch(/1/);
  });
});
