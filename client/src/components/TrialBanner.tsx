import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

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
  const isAdmin =
    firmData?.member?.firmRole === "admin" || firmData?.member?.firmRole === "subadmin";

  return (
    <div
      className={
        expired
          ? "bg-red-600 text-white px-3 sm:px-4 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-40 shrink-0"
          : "bg-[var(--color-navy)] text-white px-3 sm:px-4 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-40 shrink-0"
      }
    >
      <div className="flex items-start sm:items-center gap-2 min-w-0">
        {expired ? (
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
        )}
        <p className="text-xs sm:text-sm leading-snug">
          {expired
            ? t("trial.expired")
            : t("trial.active", { days, count: days })}
        </p>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-[var(--color-navy)] hover:bg-white/90 h-8 flex-1 sm:flex-none"
            onClick={() => navigate("/account")}
          >
            {expired ? t("trial.choosePackage") : t("trial.viewAccount")}
          </Button>
        </div>
      )}
    </div>
  );
}
