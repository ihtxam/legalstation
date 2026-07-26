import AppLayout from "@/components/AppLayout";
import { useTranslation } from "react-i18next";
import { Mail, BookOpen, ExternalLink, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@cliavo.com";
const DOCS_URL = "https://docs.cliavo.com";
const LOCAL_HELP_URL = "/help";

export default function SupportPage() {
  const { t } = useTranslation();

  return (
    <AppLayout title={t("support.title")} breadcrumb={[{ label: t("support.title") }]}>
      <div className="p-6 max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-navy)]">
            <LifeBuoy className="w-6 h-6" />
            <h2 className="text-2xl font-serif font-semibold tracking-tight">{t("support.heading")}</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{t("support.intro")}</p>
        </div>

        <section className="border border-border rounded-xl p-6 space-y-4 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-[var(--color-navy)]/8 p-2">
              <Mail className="w-5 h-5 text-[var(--color-navy)]" />
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="font-semibold text-foreground">{t("support.emailTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("support.emailHint")}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 text-[var(--color-navy)] font-medium hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        <section className="border border-border rounded-xl p-6 space-y-4 bg-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-[var(--color-navy)]/8 p-2">
              <BookOpen className="w-5 h-5 text-[var(--color-navy)]" />
            </div>
            <div className="min-w-0 space-y-3 flex-1">
              <h3 className="font-semibold text-foreground">{t("support.docsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("support.docsHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-[var(--color-navy)] hover:bg-[var(--color-navy)]/90">
                  <a href={DOCS_URL} target="_blank" rel="noreferrer">
                    {t("support.openDocs")}
                    <ExternalLink className="w-4 h-4 ml-1.5" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={LOCAL_HELP_URL} target="_blank" rel="noreferrer">
                    {t("support.openLocalHelp")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
