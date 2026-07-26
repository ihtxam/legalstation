import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const PROD_IP = "179.237.107.63";

export default function CustomDomainDnsHelp({
  customDomain,
  subdomainStatus,
  slug,
}: {
  customDomain?: string | null;
  subdomainStatus?: string | null;
  slug?: string | null;
}) {
  const { t } = useTranslation();
  const ip = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_APP_PUBLIC_IP) || PROD_IP;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold text-sm text-foreground">{t("crm.dnsTitle")}</h4>
        {subdomainStatus && (
          <Badge variant="secondary">
            {t("crm.subdomainStatus")}: {subdomainStatus}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("crm.dnsIntro")}</p>
      <ul className="text-sm space-y-2 font-mono bg-card border border-border rounded-lg p-3">
        <li>
          <span className="text-muted-foreground">A</span>{" "}
          <span className="font-sans">{t("crm.dnsARecord")}</span>{" "}
          <code className="text-[var(--color-navy)]">{ip}</code>
        </li>
        <li>
          <span className="text-muted-foreground">CNAME</span>{" "}
          <span className="font-sans">{t("crm.dnsCname")}</span>
        </li>
      </ul>
      {customDomain && (
        <p className="text-xs text-muted-foreground">
          {t("crm.dnsCurrentDomain")}: <strong className="text-foreground">{customDomain}</strong>
        </p>
      )}
      {slug && (
        <p className="text-xs text-muted-foreground">
          {t("crm.dnsSlug")}: <strong className="text-foreground">{slug}</strong>
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("crm.dnsNote", { ip: PROD_IP })}</p>
    </div>
  );
}
