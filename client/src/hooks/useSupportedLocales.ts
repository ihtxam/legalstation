import { trpc } from "@/lib/trpc";
import { APP_LOCALES, isAppLocale, type AppLocale } from "@shared/locales";

/**
 * Locales enabled at platform level (superadmin → supported languages).
 * Falls back to all product locales while loading / if the query fails.
 */
export function useSupportedLocales() {
  const { data, isLoading } = trpc.system.locales.useQuery(undefined, {
    staleTime: 60_000,
  });

  const supportedLocales: AppLocale[] =
    data?.supportedLocales?.filter(isAppLocale).length
      ? data.supportedLocales.filter(isAppLocale)
      : [...APP_LOCALES];

  const defaultLocale: AppLocale =
    data?.defaultLocale && supportedLocales.includes(data.defaultLocale)
      ? data.defaultLocale
      : supportedLocales.includes("en")
        ? "en"
        : supportedLocales[0]!;

  return {
    supportedLocales,
    defaultLocale,
    isLoading,
    isEnabled: (code: string) => isAppLocale(code) && supportedLocales.includes(code),
  };
}
