import { eq } from "drizzle-orm";
import { agencySettings } from "../drizzle/schema";
import { getDb } from "./db";
import {
  APP_CURRENCIES,
  DEFAULT_CURRENCY,
  isAppCurrency,
  type AppCurrency,
} from "../shared/currencies";

const FALLBACK_CURRENCIES: AppCurrency[] = [...APP_CURRENCIES];

export async function getPlatformCurrencyConfig(): Promise<{
  defaultCurrency: AppCurrency;
  supportedCurrencies: AppCurrency[];
}> {
  const db = await getDb();
  if (!db) {
    return { defaultCurrency: DEFAULT_CURRENCY, supportedCurrencies: FALLBACK_CURRENCIES };
  }

  const rows = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "supported_currencies"));
  const defaultRows = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "default_currency"));

  let supportedCurrencies = FALLBACK_CURRENCIES;
  try {
    const raw = rows[0]?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const list = parsed
          .map((c) => (typeof c === "string" ? c.toUpperCase() : c))
          .filter(isAppCurrency);
        if (list.length) supportedCurrencies = list;
      }
    }
  } catch {
    /* keep fallback */
  }

  let defaultCurrency: AppCurrency = DEFAULT_CURRENCY;
  const def = defaultRows[0]?.value?.toUpperCase();
  if (isAppCurrency(def) && supportedCurrencies.includes(def)) {
    defaultCurrency = def;
  } else if (!supportedCurrencies.includes(DEFAULT_CURRENCY)) {
    defaultCurrency = supportedCurrencies[0]!;
  }

  return { defaultCurrency, supportedCurrencies };
}

export async function assertCurrencyEnabled(currency: string): Promise<AppCurrency> {
  const code = currency.trim().toUpperCase();
  if (!isAppCurrency(code)) {
    throw new Error(
      `Unsupported currency "${currency}". Allowed: ${APP_CURRENCIES.join(", ")}.`
    );
  }
  const { supportedCurrencies, defaultCurrency } = await getPlatformCurrencyConfig();
  if (!supportedCurrencies.includes(code)) {
    throw new Error(
      `Currency "${code}" is disabled for this platform. Enabled: ${supportedCurrencies.join(", ")}.`
    );
  }
  return code || defaultCurrency;
}
