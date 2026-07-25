import { useEffect } from "react";
import LexLayout from "@/components/LexLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

function formatCHF(n: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(n);
}

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data, isLoading, error } = trpc.dashboard.adminAnalytics.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const timeSummary = trpc.timeEntries.summary.useQuery(
    { mineOnly: false },
    { enabled: isAuthenticated }
  );

  return (
    <LexLayout breadcrumb={[{ label: t("analytics.breadcrumb") }]}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error.message || t("analytics.adminRequired")}
            </CardContent>
          </Card>
        )}

        {isLoading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat title={t("analytics.cases")} value={String(data.totals.cases)} />
              <Stat title={t("analytics.paidRevenue")} value={formatCHF(data.totals.paidRevenue)} />
              <Stat title={t("analytics.outstanding")} value={formatCHF(data.totals.outstanding)} />
              <Stat
                title={t("analytics.billableHours")}
                value={(timeSummary.data?.billableHours ?? 0).toFixed(1)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.casesByStatus")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {Object.entries(data.casesByStatus).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.invoicesByStatus")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {Object.entries(data.invoicesByStatus).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="capitalize text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("analytics.revenueByMonth")}</CardTitle>
              </CardHeader>
              <CardContent>
                {!data.revenueByMonth.length ? (
                  <p className="text-sm text-muted-foreground">{t("analytics.noPaid")}</p>
                ) : (
                  <div className="space-y-2">
                    {data.revenueByMonth.map((row) => (
                      <div key={row.month} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{row.month}</span>
                        <span className="font-medium">{formatCHF(row.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </LexLayout>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{title}</div>
      </CardContent>
    </Card>
  );
}
