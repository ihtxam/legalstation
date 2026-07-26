import { trpc } from "@/lib/trpc";
import {
  APP_CURRENCIES,
  DEFAULT_CURRENCY,
  isAppCurrency,
  type AppCurrency,
} from "@shared/currencies";

/**
 * Currencies enabled at platform level (superadmin → supported currencies).
 * Falls back to the full catalog while loading / if the query fails.
 */
export function useSupportedCurrencies() {
  const { data, isLoading } = trpc.system.currencies.useQuery(undefined, {
    staleTime: 60_000,
  });

  const supportedCurrencies: AppCurrency[] =
    data?.supportedCurrencies?.filter(isAppCurrency).length
      ? data.supportedCurrencies.filter(isAppCurrency)
      : [...APP_CURRENCIES];

  const defaultCurrency: AppCurrency =
    data?.defaultCurrency && supportedCurrencies.includes(data.defaultCurrency)
      ? data.defaultCurrency
      : supportedCurrencies.includes(DEFAULT_CURRENCY)
        ? DEFAULT_CURRENCY
        : supportedCurrencies[0]!;

  return {
    supportedCurrencies,
    defaultCurrency,
    isLoading,
    isEnabled: (code: string) => isAppCurrency(code) && supportedCurrencies.includes(code),
  };
}
