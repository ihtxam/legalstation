/**
 * Format amount as CHF currency
 */
export function formatCurrency(amount: number, currency: string = "CHF"): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
