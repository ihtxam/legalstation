import { eq } from "drizzle-orm";
import { agencySettings } from "../drizzle/schema";
import { getDb } from "./db";
import { APP_LOCALES, isAppLocale, type AppLocale } from "../shared/locales";

const FALLBACK_LOCALES: AppLocale[] = [...APP_LOCALES];

export async function getPlatformLocaleConfig(): Promise<{
  defaultLocale: AppLocale;
  supportedLocales: AppLocale[];
}> {
  const db = await getDb();
  if (!db) {
    return { defaultLocale: "en", supportedLocales: FALLBACK_LOCALES };
  }

  const rows = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "supported_locales"));
  const defaultRows = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "default_locale"));

  let supportedLocales = FALLBACK_LOCALES;
  try {
    const raw = rows[0]?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const list = parsed.filter(isAppLocale);
        if (list.length) supportedLocales = list;
      }
    }
  } catch {
    /* keep fallback */
  }

  let defaultLocale: AppLocale = "en";
  const def = defaultRows[0]?.value;
  if (isAppLocale(def) && supportedLocales.includes(def)) {
    defaultLocale = def;
  } else if (!supportedLocales.includes("en")) {
    defaultLocale = supportedLocales[0]!;
  }

  return { defaultLocale, supportedLocales };
}

export async function assertLocaleEnabled(locale: string): Promise<AppLocale> {
  if (!isAppLocale(locale)) {
    throw new Error("Unsupported locale");
  }
  const { supportedLocales, defaultLocale } = await getPlatformLocaleConfig();
  if (!supportedLocales.includes(locale)) {
    throw new Error(
      `Language "${locale}" is disabled for this platform. Enabled: ${supportedLocales.join(", ")}.`
    );
  }
  return locale || defaultLocale;
}
