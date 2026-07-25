import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const CONTINUE_MAIL =
  "mailto:corporateshift@gmail.com?subject=LexFlow%20trial%20%E2%80%94%20continue%20SaaS";
const ONPREM_MAIL =
  "mailto:corporateshift@gmail.com?subject=LexFlow%20trial%20%E2%80%94%20on-premise%20setup";

export default function TrialBanner() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });

  const sub = firmData?.subscription;
  if (!sub || sub.status !== "trialing") return null;

  const expired = Boolean(sub.trialExpired);
  const days = sub.trialDaysLeft;

  return (
    <div
      className={
        expired
          ? "bg-red-600 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap z-40"
          : "bg-[var(--color-navy)] text-white px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap z-40"
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        {expired ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0" />
        )}
        <p className="truncate">
          {expired
            ? t("trial.expired")
            : t("trial.active", { days, count: days })}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white text-[var(--color-navy)] hover:bg-white/90 h-8"
          onClick={() => navigate("/settings")}
        >
          {t("trial.whitelabel")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/50 bg-transparent text-white hover:bg-white/10 h-8"
          asChild
        >
          <a href={CONTINUE_MAIL}>{t("trial.continueSaas")}</a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/50 bg-transparent text-white hover:bg-white/10 h-8"
          asChild
        >
          <a href={ONPREM_MAIL}>{t("trial.onPremise")}</a>
        </Button>
      </div>
    </div>
  );
}
