import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_CURRENCY, formatMoney } from "@shared/currencies";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amount as currency (defaults to CHF).
 * Prefer passing the firm / invoice currency explicitly.
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return formatMoney(amount, currency);
}
