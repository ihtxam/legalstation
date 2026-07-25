/** Supported UI locales for LexFlow (product + platform). */
export const APP_LOCALES = ["en", "fr", "de", "it", "ar"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ar: "العربية",
};

export const RTL_LOCALES = new Set<AppLocale>(["ar"]);

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale as AppLocale);
}
