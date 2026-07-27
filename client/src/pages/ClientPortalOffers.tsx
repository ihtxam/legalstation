import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function ClientPortalOffersPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [planBillingInterval, setPlanBillingInterval] = useState<
    "monthly" | "biannual" | "yearly" | null
  >(null);
  const [planPackageId, setPlanPackageId] = useState<number | null>(null);

  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });
  const { data: mySub, refetch: refetchSub } = trpc.clientPackages.mySubscription.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: portalPackages } = trpc.clientPackages.listForClient.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const changePlan = trpc.clientPackages.changePlan.useMutation({
    onSuccess: async () => {
      toast.success(t("packages.planChanged"));
      setPlanPackageId(null);
      setPlanBillingInterval(null);
      await refetchSub();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <AppLayout breadcrumb={[{ label: t("nav.offers") }]}>
        <Skeleton className="h-64 w-full m-6" />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumb={[{ label: t("nav.offers") }]}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name || t("settings.logo")}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-[var(--color-navy)]/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[var(--color-navy)]" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("nav.offers")}</h1>
              <p className="text-muted-foreground mt-2">
                {branding?.name
                  ? t("portal.offersSubtitle", { firm: branding.name })
                  : t("portal.offersSubtitleFallback")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <p className="font-medium text-sm">
            {mySub?.hasSubscription
              ? t("packages.currentPlan", { name: mySub.package?.name })
              : t("packages.noActivePlan")}
          </p>
          {mySub?.hasSubscription ? (
            <p className="text-xs text-muted-foreground">
              {t("packages.quotaUsed", {
                used: mySub.quota.casesUsed,
                allowed: mySub.quota.casesAllowed,
              })}
              {mySub.package &&
              Number(
                mySub.package.consultationHoursPerYear ??
                  mySub.package.consultationHoursPerPeriod
              ) > 0
                ? ` · ${t("packages.consultHours", {
                    hours:
                      mySub.package.consultationHoursPerYear ??
                      mySub.package.consultationHoursPerPeriod,
                  })}`
                : ""}
              {" · "}
              {t("packages.periodEnds", {
                date: new Date(mySub.subscription!.currentPeriodEnd).toLocaleDateString(),
              })}
              {mySub.subscription?.commitmentEndsAt
                ? ` · ${t("packages.commitmentEnds", {
                    date: new Date(mySub.subscription.commitmentEndsAt).toLocaleDateString(),
                  })}`
                : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("packages.plansHint")}</p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-foreground">{t("packages.plansForYou")}</h2>
            <p className="text-sm text-muted-foreground">{t("packages.plansHint")}</p>
          </div>
          {(portalPackages || []).map((pkg) => {
            const intervals =
              (pkg.availableIntervals as Array<"monthly" | "biannual" | "yearly"> | undefined) ||
              [];
            const selected = planPackageId === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`w-full text-start border rounded-xl p-4 space-y-2 bg-card ${
                  selected ? "border-[var(--color-navy)]" : "border-border"
                }`}
              >
                <button
                  type="button"
                  className="w-full text-start space-y-1"
                  disabled={changePlan.isPending}
                  onClick={() => {
                    setPlanPackageId(pkg.id);
                    setPlanBillingInterval(intervals[0] || "monthly");
                  }}
                >
                  <p className="font-medium">
                    {pkg.highlightLabel ? (
                      <Badge variant="outline" className="me-2">
                        {pkg.highlightLabel}
                      </Badge>
                    ) : null}
                    {pkg.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      Number(pkg.monthlyPrice || 0) > 0
                        ? `${Number(pkg.monthlyPrice).toFixed(2)} ${pkg.currency}/${t("packages.monthlyShort")}`
                        : null,
                      Number(pkg.biannualPrice || 0) > 0
                        ? `${Number(pkg.biannualPrice).toFixed(2)} ${pkg.currency}/${t("packages.biannualShort")}`
                        : null,
                      Number(pkg.yearlyPrice || 0) > 0
                        ? `${Number(pkg.yearlyPrice).toFixed(2)} ${pkg.currency}/${t("packages.yearlyShort")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") ||
                      `${Number(pkg.price).toFixed(2)} ${pkg.currency} / ${pkg.billingInterval}`}
                    {(pkg.consultationHoursPerYear ?? pkg.consultationHoursPerPeriod) > 0
                      ? ` · ${t("packages.consultHours", {
                          hours:
                            pkg.consultationHoursPerYear ?? pkg.consultationHoursPerPeriod,
                        })}`
                      : ""}
                    {(pkg.casesPerYear ?? pkg.casesPerPeriod) > 0
                      ? ` · ${t("packages.casesPerYear", {
                          count: pkg.casesPerYear ?? pkg.casesPerPeriod,
                        })}`
                      : ""}
                    {pkg.includedFixedHours > 0
                      ? ` · ${t("packages.fixedHours", { hours: pkg.includedFixedHours })}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("packages.minCommitmentHint")}</p>
                  {(pkg.features || []).length > 0 ? (
                    <ul className="text-xs text-muted-foreground list-disc ps-4">
                      {(pkg.features as string[]).slice(0, 4).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </button>
                {selected && intervals.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <Label>{t("packages.chooseBilling")}</Label>
                    <Select
                      value={planBillingInterval || intervals[0]}
                      onValueChange={(v) =>
                        setPlanBillingInterval(v as "monthly" | "biannual" | "yearly")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intervals.map((iv) => (
                          <SelectItem key={iv} value={iv}>
                            {iv === "biannual"
                              ? t("packages.biannual")
                              : iv === "yearly"
                                ? t("packages.yearly")
                                : t("packages.monthly")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full"
                      disabled={changePlan.isPending || !planBillingInterval}
                      onClick={() =>
                        changePlan.mutate({
                          packageId: pkg.id,
                          billingInterval: planBillingInterval || intervals[0],
                        })
                      }
                    >
                      {changePlan.isPending
                        ? t("common.loading")
                        : mySub?.hasSubscription
                          ? t("packages.changePlan")
                          : t("packages.buyPlan")}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!portalPackages?.length ? (
            <div className="border border-border rounded-xl p-8 text-center bg-card">
              <p className="text-sm text-muted-foreground">{t("packages.noPublicPackages")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
