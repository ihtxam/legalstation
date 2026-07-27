import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const STORAGE_PREFIX = "cliavo_cookie_consent_v1";

type Scope = "platform" | { firm: string };

function storageKey(scope: Scope): string {
  return typeof scope === "string" ? `${STORAGE_PREFIX}:platform` : `${STORAGE_PREFIX}:firm:${scope.firm}`;
}

type Props = {
  scope: Scope;
  policyHref: string;
  privacyHref?: string;
  brandName?: string;
};

/**
 * Cookie / privacy consent banner (Clip.com-style bottom bar).
 * Shown on first visit to platform or a firm public site until accepted.
 */
export default function CookieConsentBanner({
  scope,
  policyHref,
  privacyHref,
  brandName = "Cliavo",
}: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(scope));
      if (!raw) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [scope]);

  const accept = () => {
    try {
      localStorage.setItem(
        storageKey(scope),
        JSON.stringify({ acceptedAt: new Date().toISOString(), version: 1 })
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("legal.cookieBannerTitle")}
      className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg px-4 py-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
            <Cookie className="w-4 h-4 text-[var(--color-navy)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("legal.cookieBannerTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t("legal.cookieBannerBody", { brand: brandName })}{" "}
              <Link href={policyHref} className="underline text-[var(--color-navy)]">
                {t("legal.cookiePolicy")}
              </Link>
              {privacyHref ? (
                <>
                  {" · "}
                  <Link href={privacyHref} className="underline text-[var(--color-navy)]">
                    {t("legal.privacy")}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 sm:ms-auto">
          <Button variant="outline" size="sm" onClick={() => { window.location.href = policyHref; }}>
            {t("legal.learnMore")}
          </Button>
          <Button
            size="sm"
            className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-light)]"
            onClick={accept}
          >
            {t("legal.acceptCookies")}
          </Button>
        </div>
      </div>
    </div>
  );
}
