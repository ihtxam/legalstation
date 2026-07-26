import { DEFAULT_CURRENCY, formatMoney } from "./currencies";

/**
 * Format amount as currency (defaults to CHF).
 * Prefer passing the firm / invoice currency explicitly.
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return formatMoney(amount, currency);
}

/**
 * Calculate VAT amount
 */
export function calculateVat(subtotal: number, vatRate: number): number {
  return Math.round((subtotal * vatRate) / 100);
}

/**
 * Calculate total with VAT
 */
export function calculateTotal(subtotal: number, vatRate: number): number {
  const vat = calculateVat(subtotal, vatRate);
  return subtotal + vat;
}

/**
 * Format date as DD.MM.YYYY (Swiss format)
 */
export function formatDateSwiss(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
