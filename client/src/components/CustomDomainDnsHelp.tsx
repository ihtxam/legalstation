import { useTranslation } from "react-i18next";

const FALLBACK_IP = "179.237.107.63";
const FALLBACK_BASE_DOMAIN = "cliavo.com";

/**
 * Minimal "connect your domain" instructions: one CNAME record pointing the
 * firm's domain at their Cliavo subdomain, shown as a concrete example.
 */
export default function CustomDomainDnsHelp({
  customDomain,
  slug,
  baseDomain,
}: {
  customDomain?: string | null;
  slug?: string | null;
  baseDomain?: string | null;
}) {
  const { t } = useTranslation();
  const target = `${(slug || "your-firm").trim()}.${(baseDomain || FALLBACK_BASE_DOMAIN).trim()}`;
  const domain = (customDomain || "").trim() || t("crm.dnsExampleDomain");

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <h4 className="font-semibold text-sm text-foreground">{t("crm.dnsTitle")}</h4>
      <p className="text-sm text-muted-foreground">{t("crm.dnsCnameIntro")}</p>
      <div className="bg-card border border-border rounded-lg p-3 overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="text-xs text-muted-foreground text-left">
              <th className="pr-6 font-medium">{t("crm.dnsColType")}</th>
              <th className="pr-6 font-medium">{t("crm.dnsColName")}</th>
              <th className="font-medium">{t("crm.dnsColValue")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-mono">
              <td className="pr-6 pt-1">CNAME</td>
              <td className="pr-6 pt-1">{domain}</td>
              <td className="pt-1 text-[var(--color-navy)]">{target}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("crm.dnsApexNote", { ip: FALLBACK_IP })} {t("crm.dnsPropagationNote")}
      </p>
    </div>
  );
}
