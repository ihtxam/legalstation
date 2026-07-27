import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Scale } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import FirmPublicSitePage from "@/pages/FirmPublicSite";

type Kind = "terms" | "privacy" | "cookies";

const TITLES: Record<Kind, string> = {
  terms: "legal.terms",
  privacy: "legal.privacy",
  cookies: "legal.cookiePolicy",
};

function kindFromPath(path: string): Kind {
  if (path.includes("terms")) return "terms";
  if (path.includes("cookies")) return "cookies";
  return "privacy";
}

export default function PlatformLegalPage() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const kind = kindFromPath(location);
  const [hostMode, setHostMode] = useState<"loading" | "platform" | "firm">("loading");

  useEffect(() => {
    fetch("/api/auth/tenant")
      .then((r) => r.json())
      .then((d) => setHostMode(d?.mode === "firm" ? "firm" : "platform"))
      .catch(() => setHostMode("platform"));
  }, []);

  const { data, isLoading } = trpc.platformLegal.getPublic.useQuery(undefined, {
    enabled: hostMode === "platform",
  });

  useEffect(() => {
    if (hostMode !== "platform") return;
    document.title = `${t(TITLES[kind])} · ${data?.agencyName || "Cliavo"}`;
  }, [kind, data?.agencyName, t, hostMode]);

  if (hostMode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Firm custom domain / subdomain: serve firm CMS legal pages
  if (hostMode === "firm") return <FirmPublicSitePage />;

  const html =
    kind === "terms"
      ? data?.termsHtml
      : kind === "privacy"
        ? data?.privacyHtml
        : data?.cookiesHtml;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-white" />
            </span>
            <span className="font-semibold truncate">{data?.agencyName || "Cliavo"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              {t("legal.backHome")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {isLoading ? (
          <div className="max-w-3xl mx-auto px-6 py-12 space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div
            className="prose prose-slate dark:prose-invert max-w-3xl mx-auto px-6 py-12"
            dangerouslySetInnerHTML={{
              __html:
                html ||
                `<h1>${t(TITLES[kind])}</h1><p>${t("legal.placeholderBody")}</p>`,
            }}
          />
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground space-x-3">
        <Link href="/legal/terms" className="hover:underline">
          {t("legal.terms")}
        </Link>
        <Link href="/legal/privacy" className="hover:underline">
          {t("legal.privacy")}
        </Link>
        <Link href="/legal/cookies" className="hover:underline">
          {t("legal.cookiePolicy")}
        </Link>
      </footer>

      {data?.cookieBannerEnabled !== false ? (
        <CookieConsentBanner
          scope="platform"
          policyHref="/legal/cookies"
          privacyHref="/legal/privacy"
          brandName={data?.agencyName || "Cliavo"}
        />
      ) : null}
    </div>
  );
}
