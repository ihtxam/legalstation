import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setAppLocale } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { APP_LOCALES, APP_LOCALE_LABELS, isAppLocale, type AppLocale } from "@shared/locales";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
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
 */
export function LanguageSwitcher({ compact = true, className }: Props) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, refresh } = useAuth();
  const [locale, setLocale] = useState<AppLocale>(
    isAppLocale(i18n.language) ? i18n.language : "en"
  );

  const setLocaleMutation = trpc.auth.setLocale.useMutation({
    onSuccess: async (r) => {
      setAppLocale(r.locale);
      setLocale(r.locale);
      await refresh();
      toast.success(t("settings.languageUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (isAppLocale(user?.preferredLocale)) {
      setLocale(user.preferredLocale);
      return;
    }
    if (isAppLocale(i18n.language)) setLocale(i18n.language);
  }, [user?.preferredLocale, i18n.language]);

  const onChange = (value: string) => {
    if (!isAppLocale(value)) return;
    setLocale(value);
    setAppLocale(value);
    if (isAuthenticated) {
      setLocaleMutation.mutate({ locale: value });
    }
  };

  return (
    <div className={className}>
      <Select value={locale} onValueChange={onChange}>
        <SelectTrigger
          className={compact ? "h-9 w-[9.5rem] bg-background" : "max-w-xs"}
          aria-label={t("common.language")}
        >
          <Languages className="w-3.5 h-3.5 me-1.5 shrink-0 opacity-70" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {APP_LOCALES.map((code) => (
            <SelectItem key={code} value={code}>
              {APP_LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
