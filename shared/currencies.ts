/**
 * Platform currency catalog for multi-country launch (CH, EU, UAE, KSA, wider Middle East).
 * ISO 4217 codes; amounts are stored as decimal major units (not minor units).
 */

export const APP_CURRENCIES = [
  "CHF",
  "EUR",
  "USD",
  "GBP",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "JOD",
] as const;

export type AppCurrency = (typeof APP_CURRENCIES)[number];

export type CurrencyMeta = {
  code: AppCurrency;
  /** English label */
  name: string;
  /** Symbol hint for UI (Intl still formats amounts) */
  symbol: string;
  /** ISO fraction digits for display */
  fractionDigits: number;
  /** BCP 47 locale for number formatting */
  locale: string;
  /** Regions this currency primarily supports */
  regions: string[];
};

export const CURRENCY_META: Record<AppCurrency, CurrencyMeta> = {
  CHF: {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "CHF",
    fractionDigits: 2,
    locale: "de-CH",
    regions: ["CH", "LI"],
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    fractionDigits: 2,
    locale: "de-DE",
    regions: ["EU", "EEA"],
  },
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    fractionDigits: 2,
    locale: "en-US",
    regions: ["US", "ME"],
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    fractionDigits: 2,
    locale: "en-GB",
    regions: ["GB"],
  },
  AED: {
    code: "AED",
    name: "UAE Dirham",
    symbol: "AED",
    fractionDigits: 2,
    locale: "en-AE",
    regions: ["AE"],
  },
  SAR: {
    code: "SAR",
    name: "Saudi Riyal",
    symbol: "SAR",
    fractionDigits: 2,
    locale: "en-SA",
    regions: ["SA"],
  },
  QAR: {
    code: "QAR",
    name: "Qatari Riyal",
    symbol: "QAR",
    fractionDigits: 2,
    locale: "en-QA",
    regions: ["QA"],
  },
  KWD: {
    code: "KWD",
    name: "Kuwaiti Dinar",
    symbol: "KWD",
    fractionDigits: 3,
    locale: "en-KW",
    regions: ["KW"],
  },
  BHD: {
    code: "BHD",
    name: "Bahraini Dinar",
    symbol: "BHD",
    fractionDigits: 3,
    locale: "en-BH",
    regions: ["BH"],
  },
  OMR: {
    code: "OMR",
    name: "Omani Rial",
    symbol: "OMR",
    fractionDigits: 3,
    locale: "en-OM",
    regions: ["OM"],
  },
  JOD: {
    code: "JOD",
    name: "Jordanian Dinar",
    symbol: "JOD",
    fractionDigits: 3,
    locale: "en-JO",
    regions: ["JO"],
  },
};

/** Currencies Swiss QR-bill supports (ISO 20022 Swiss payment standard). */
export const SWISS_QR_CURRENCIES = new Set<string>(["CHF", "EUR"]);

export const DEFAULT_CURRENCY: AppCurrency = "CHF";

export function isAppCurrency(value: unknown): value is AppCurrency {
  return typeof value === "string" && (APP_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

export function normalizeCurrency(value: unknown, fallback: AppCurrency = DEFAULT_CURRENCY): AppCurrency {
  if (typeof value !== "string") return fallback;
  const code = value.trim().toUpperCase();
  return isAppCurrency(code) ? code : fallback;
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  const normalized = normalizeCurrency(code);
  return CURRENCY_META[normalized];
}

export function currencyLabel(code: string): string {
  const meta = getCurrencyMeta(code);
  return `${meta.code} — ${meta.name}`;
}

export function supportsSwissQrCurrency(code: string): boolean {
  return SWISS_QR_CURRENCIES.has(String(code || "").toUpperCase());
}

/**
 * Format a major-unit amount in the given currency.
 */
export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const meta = getCurrencyMeta(currency);
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return formatMoney(0, meta.code);
  }
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: meta.fractionDigits,
    maximumFractionDigits: meta.fractionDigits,
  }).format(n);
}
