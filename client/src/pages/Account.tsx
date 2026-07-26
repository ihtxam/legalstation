import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Clock, AlertTriangle, Check, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.firm.account.useQuery(undefined, {
    enabled: Boolean(user) && user?.role !== "superadmin",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      toast.success(t("account.upgradeSuccess"));
      void utils.firm.myFirm.invalidate();
      void refetch();
      window.history.replaceState({}, "", "/account");
    } else if (params.get("cancelled") === "1") {
      toast.message(t("account.upgradeCancelled"));
      window.history.replaceState({}, "", "/account");
    }
  }, [t, refetch, utils.firm.myFirm]);

  const checkout = trpc.firm.createPlanCheckout.useMutation({
    onSuccess: async (res) => {
      if (res.activated) {
        toast.success(t("account.upgradeSuccess"));
        await utils.firm.myFirm.invalidate();
        await refetch();
        return;
      }
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(t("account.checkoutFailed"));
    },
    onError: (e) => toast.error(e.message),
  });

  const sub = data?.subscription;
  const locked = Boolean(sub?.locked);
  const currentPlanId = sub?.planId;

  return (
    <AppLayout title={t("account.title")} breadcrumb={[{ label: t("account.title") }]}>
      <div className="page-shell max-w-4xl !space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[var(--color-navy)]" />
            {t("account.heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("account.intro")}</p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

        {data && (
          <>
            <section className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{data.firm.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {data.firm.email || data.firm.slug}
                  </p>
                </div>
                <Badge variant={locked ? "destructive" : sub?.trialActive ? "default" : "secondary"}>
                  {locked
                    ? t("account.statusLocked")
                    : sub?.trialActive
                      ? t("account.statusTrial")
                      : sub?.status === "active"
                        ? t("account.statusActive")
                        : sub?.status || "—"}
                </Badge>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t("account.currentPlan")}</p>
                  <p className="font-semibold mt-1">{sub?.planName || t("account.noPlan")}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t("account.trialRemaining")}
                  </p>
                  <p className="font-semibold mt-1">
                    {sub?.trialActive
                      ? t("account.daysLeft", { days: sub.trialDaysLeft, count: sub.trialDaysLeft })
                      : sub?.trialExpired
                        ? t("account.trialEnded")
                        : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t("account.access")}</p>
                  <p className="font-semibold mt-1 flex items-center gap-1.5">
                    {locked ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        {t("account.lockedHint")}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        {t("account.openHint")}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {locked && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {t("account.lockoutMessage")}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="page-header">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t("account.packagesTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{t("account.packagesHint")}</p>
                </div>
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md",
                      billingCycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"
                    )}
                    onClick={() => setBillingCycle("monthly")}
                  >
                    {t("account.monthly")}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md",
                      billingCycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"
                    )}
                    onClick={() => setBillingCycle("yearly")}
                  >
                    {t("account.yearly")}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {data.plans.map((plan) => {
                  const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                  const isCurrent = currentPlanId === plan.id && sub?.status === "active";
                  return (
                    <div
                      key={plan.id}
                      className={cn(
                        "rounded-xl border p-5 space-y-3 bg-card",
                        isCurrent ? "border-[var(--color-navy)] ring-1 ring-[var(--color-navy)]/30" : "border-border"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-foreground">{plan.name}</h4>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                          )}
                        </div>
                        {isCurrent && <Badge>{t("account.current")}</Badge>}
                      </div>
                      <p className="text-2xl font-semibold tracking-tight">
                        CHF {Number(price).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{billingCycle === "yearly" ? t("account.yr") : t("account.mo")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("account.maxUsers", { count: plan.maxUsers })}
                      </p>
                      {plan.features.length > 0 && (
                        <ul className="space-y-1.5 text-sm">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className="w-4 h-4 text-[var(--color-navy)] shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        className="w-full bg-[var(--color-navy)] text-white"
                        disabled={isCurrent || checkout.isPending}
                        onClick={() =>
                          checkout.mutate({ planId: plan.id, billingCycle })
                        }
                      >
                        {isCurrent
                          ? t("account.current")
                          : Number(price) === 0
                            ? t("account.activateFree")
                            : t("account.upgrade")}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {!data.plans.length && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("account.noPlans")}
                </p>
              )}

              {!data.stripeConfigured && (
                <p className="text-xs text-muted-foreground">{t("account.stripeHint")}</p>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
