import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setAppLocale } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { APP_LOCALE_LABELS, isAppLocale, type AppLocale } from "@shared/locales";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSupportedLocales } from "@/hooks/useSupportedLocales";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Languages } from "lucide-react";

type Props = {
  /** Compact trigger for headers/toolbars */
  compact?: boolean;
  className?: string;
};

/**
 * Persist UI language for the signed-in user (and localStorage for guests).
 * Only offers locales enabled at platform level.
 */
export function LanguageSwitcher({ compact = true, className }: Props) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, refresh } = useAuth();
  const { supportedLocales, defaultLocale, isEnabled } = useSupportedLocales();
  const [locale, setLocale] = useState<AppLocale>(
    isAppLocale(i18n.language) ? i18n.language : "en"
  );
  /** Prevents server preferredLocale from overwriting an in-flight user choice. */
  const pendingLocale = useRef<AppLocale | null>(null);

  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: async (r) => {
      pendingLocale.current = null;
      setAppLocale(r.locale);
      setLocale(r.locale);
      await refresh();
      toast.success(t("settings.languageUpdated"));
    },
    onError: (e) => {
      pendingLocale.current = null;
      toast.error(e.message);
    },
  });

  useEffect(() => {
    if (pendingLocale.current) return;
    const preferred = isAppLocale(user?.preferredLocale) ? user.preferredLocale : null;
    const current = isAppLocale(i18n.language) ? i18n.language : null;
    const next =
      (preferred && isEnabled(preferred) && preferred) ||
      (current && isEnabled(current) && current) ||
      defaultLocale;
    setLocale(next);
    if (i18n.language !== next) setAppLocale(next);
  }, [user?.preferredLocale, i18n.language, defaultLocale, isEnabled, supportedLocales]);

  const onChange = (value: string) => {
    if (!isAppLocale(value) || !isEnabled(value)) return;
    pendingLocale.current = value;
    setLocale(value);
    setAppLocale(value);
    if (isAuthenticated) {
      setLocaleMutation.mutate({ locale: value });
    } else {
      pendingLocale.current = null;
    }
  };

  return (
    <div className={className}>
      <Select
        value={locale}
        onValueChange={onChange}
        disabled={setLocaleMutation.isPending}
      >
        <SelectTrigger
          className={compact ? "h-9 w-[9.5rem] bg-background" : "max-w-xs"}
          aria-label={t("common.language")}
        >
          <Languages className="w-3.5 h-3.5 me-1.5 shrink-0 opacity-70" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[80]">
          {supportedLocales.map((code) => (
            <SelectItem key={code} value={code}>
              {APP_LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
