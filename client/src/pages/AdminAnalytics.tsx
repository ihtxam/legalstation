import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";
import { Target, TrendingUp, Package, BriefcaseBusiness, ArrowRight } from "lucide-react";

function formatCHF(n: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function formatMonth(key: string) {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

const PIE_COLORS = [
  "var(--color-navy)",
  "var(--color-gold)",
  "hsl(173 58% 39%)",
  "hsl(12 76% 61%)",
  "hsl(197 37% 45%)",
  "hsl(43 74% 49%)",
  "hsl(27 87% 67%)",
  "hsl(215 20% 55%)",
];

type ScenarioId = "conservative" | "base" | "ambitious";

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [scenario, setScenario] = useState<ScenarioId>("base");

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

  const revenueConfig = {
    total: { label: t("analytics.paidRevenue"), color: "var(--color-navy)" },
    services: { label: t("analytics.serviceRevenue"), color: "hsl(173 58% 39%)" },
  } satisfies ChartConfig;

  const forecastConfig = {
    baseline: { label: t("analytics.baselineInvoices"), color: "hsl(215 20% 55%)" },
    packages: { label: t("analytics.packageMrr"), color: "var(--color-navy)" },
    services: { label: t("analytics.serviceRevenue"), color: "hsl(173 58% 39%)" },
  } satisfies ChartConfig;

  const statusConfig = {
    value: { label: t("common.status"), color: "var(--color-navy)" },
  } satisfies ChartConfig;

  const casesStatusData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.casesByStatus).map(([name, value]) => ({
      name,
      value,
      fill: PIE_COLORS[0],
    }));
  }, [data]);

  const invoiceStatusData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.invoicesByStatus).map(([name, value]) => ({
      name,
      value,
    }));
  }, [data]);

  const casesTypeData = useMemo(() => {
    if (!data) return [];
    return data.casesByType.map((row, i) => ({
      ...row,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data]);

  const packageMixData = useMemo(() => {
    if (!data) return [];
    return data.packageMix.map((row, i) => ({
      ...row,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data]);

  const revenueTrend = useMemo(() => {
    if (!data) return [];
    const svc = new Map(data.serviceRevenueByMonth.map((r) => [r.month, r.total]));
    return data.revenueByMonth.map((r) => ({
      month: r.month,
      label: formatMonth(r.month),
      total: r.total,
      services: svc.get(r.month) || 0,
    }));
  }, [data]);

  const selected = data?.upsellForecast.scenarios[scenario];

  return (
    <AppLayout breadcrumb={[{ label: t("analytics.breadcrumb") }]}>
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
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat title={t("analytics.cases")} value={String(data.totals.cases)} />
              <Stat title={t("analytics.clients")} value={String(data.totals.clients)} />
              <Stat title={t("analytics.paidRevenue")} value={formatCHF(data.totals.paidRevenue)} />
              <Stat title={t("analytics.outstanding")} value={formatCHF(data.totals.outstanding)} />
              <Stat
                title={t("analytics.packageMrr")}
                value={formatCHF(data.totals.packageMrr)}
                hint={t("analytics.perMonth")}
              />
              <Stat
                title={t("analytics.billableHours")}
                value={(timeSummary.data?.billableHours ?? 0).toFixed(1)}
              />
            </div>

            {/* Upsell forecast */}
            <Card className="border-[var(--color-navy)]/20">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {t("analytics.upsellTitle")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("analytics.upsellSubtitle")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["conservative", "base", "ambitious"] as const).map((id) => (
                      <Button
                        key={id}
                        size="sm"
                        variant={scenario === id ? "default" : "outline"}
                        onClick={() => setScenario(id)}
                      >
                        {t(`analytics.scenario.${id}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Stat
                        title={t("analytics.newPackageClients")}
                        value={String(selected.newPackageClients)}
                        compact
                      />
                      <Stat
                        title={t("analytics.serviceOrdersMonth")}
                        value={String(selected.serviceOrdersPerMonth)}
                        compact
                      />
                      <Stat
                        title={t("analytics.upsell6m")}
                        value={formatCHF(selected.totalUpsell6m)}
                        compact
                        accent
                      />
                      <Stat
                        title={t("analytics.totalRevenue6m")}
                        value={formatCHF(selected.totalWithBaseline6m)}
                        compact
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("analytics.upsellExplain", {
                        packages: formatCHF(selected.packageRevenue6m),
                        services: formatCHF(selected.serviceRevenue6m),
                        clients: data.totals.clientsWithoutPackage,
                      })}
                    </p>
                    <ChartContainer config={forecastConfig} className="h-[260px] w-full aspect-auto">
                      <AreaChart data={data.upsellForecast.projectionByMonth}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={formatMonth}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name) => (
                                <span>
                                  {formatCHF(Number(value))}{" "}
                                  <span className="text-muted-foreground">
                                    {forecastConfig[name as keyof typeof forecastConfig]?.label ||
                                      String(name)}
                                  </span>
                                </span>
                              )}
                              labelFormatter={(label) => formatMonth(String(label))}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Area
                          type="monotone"
                          dataKey="baseline"
                          stackId="1"
                          stroke="var(--color-baseline)"
                          fill="var(--color-baseline)"
                          fillOpacity={0.25}
                        />
                        <Area
                          type="monotone"
                          dataKey="packages"
                          stackId="1"
                          stroke="var(--color-packages)"
                          fill="var(--color-packages)"
                          fillOpacity={0.45}
                        />
                        <Area
                          type="monotone"
                          dataKey="services"
                          stackId="1"
                          stroke="var(--color-services)"
                          fill="var(--color-services)"
                          fillOpacity={0.55}
                        />
                      </AreaChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/upselling">
                        <Button variant="outline" size="sm">
                          {t("nav.upselling")}
                          <ArrowRight className="w-3.5 h-3.5 ms-1.5" />
                        </Button>
                      </Link>
                      <Link href="/packages">
                        <Button variant="outline" size="sm">
                          <Package className="w-3.5 h-3.5 me-1.5" />
                          {t("nav.packages")}
                        </Button>
                      </Link>
                      <Link href="/services">
                        <Button variant="outline" size="sm">
                          <BriefcaseBusiness className="w-3.5 h-3.5 me-1.5" />
                          {t("nav.services")}
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            {/* Targets */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  {t("analytics.targetsTitle")}
                </CardTitle>
                <CardDescription>{t("analytics.targetsSubtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <TargetRow
                  label={t("analytics.targetSubscribers")}
                  current={`${data.targets.currentSubscribers}`}
                  target={`${data.targets.targetSubscribers}`}
                  progress={data.targets.progress.subscribers}
                  detail={t("analytics.conversionDetail", {
                    current: Math.round(data.totals.conversionRate * 100),
                    target: Math.round(data.targets.targetConversion * 100),
                  })}
                />
                <TargetRow
                  label={t("analytics.targetPackageMrr")}
                  current={formatCHF(data.targets.currentPackageMrr)}
                  target={formatCHF(data.targets.targetPackageMrr)}
                  progress={data.targets.progress.packageMrr}
                  detail={t("analytics.avgPackage", {
                    amount: formatCHF(data.targets.avgPackageMonthly),
                  })}
                />
                <TargetRow
                  label={t("analytics.targetServiceRevenue")}
                  current={formatCHF(data.targets.currentMonthlyServiceRevenue)}
                  target={formatCHF(data.targets.targetMonthlyServiceRevenue)}
                  progress={data.targets.progress.serviceRevenue}
                  detail={t("analytics.avgService", {
                    amount: formatCHF(data.targets.avgServicePrice),
                    orders: data.targets.targetServiceOrdersPerMonth,
                  })}
                />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {t("analytics.catalogPackages", { count: data.catalog.activePackages })}
                  </Badge>
                  <Badge variant="outline">
                    {t("analytics.catalogServices", { count: data.catalog.activeServices })}
                  </Badge>
                  <Badge variant="outline">
                    {t("analytics.clientsWithoutPackage", {
                      count: data.totals.clientsWithoutPackage,
                    })}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.revenueByMonth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={revenueConfig} className="h-[260px] w-full aspect-auto">
                    <BarChart data={revenueTrend}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) =>
                              `${formatCHF(Number(value))} · ${
                                revenueConfig[name as keyof typeof revenueConfig]?.label || name
                              }`
                            }
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="services" fill="var(--color-services)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.casesByType")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!casesTypeData.length ? (
                    <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
                  ) : (
                    <ChartContainer
                      config={{ count: { label: t("analytics.cases"), color: "var(--color-navy)" } }}
                      className="h-[260px] w-full aspect-auto"
                    >
                      <PieChart>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _n, item) =>
                                `${item?.payload?.type || ""}: ${value}`
                              }
                              nameKey="type"
                            />
                          }
                        />
                        <Pie
                          data={casesTypeData}
                          dataKey="count"
                          nameKey="type"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {casesTypeData.map((entry, i) => (
                            <Cell key={entry.type} fill={entry.fill || PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="type" />} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.casesByStatus")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={statusConfig} className="h-[220px] w-full aspect-auto">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={casesStatusData.map((d, i) => ({
                          ...d,
                          fill: PIE_COLORS[i % PIE_COLORS.length],
                        }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                      >
                        {casesStatusData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.invoicesByStatus")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={statusConfig} className="h-[220px] w-full aspect-auto">
                    <BarChart data={invoiceStatusData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tickLine={false}
                        axisLine={false}
                        className="capitalize"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-navy)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("analytics.packageMix")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!packageMixData.length ? (
                    <p className="text-sm text-muted-foreground">{t("analytics.noSubscribers")}</p>
                  ) : (
                    <ChartContainer
                      config={{ count: { label: t("analytics.subscribers"), color: "var(--color-gold)" } }}
                      className="h-[220px] w-full aspect-auto"
                    >
                      <PieChart>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _n, item) =>
                                `${item?.payload?.name || ""}: ${value}`
                              }
                            />
                          }
                        />
                        <Pie
                          data={packageMixData}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={75}
                        >
                          {packageMixData.map((entry, i) => (
                            <Cell key={entry.name} fill={entry.fill || PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({
  title,
  value,
  hint,
  compact,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  compact?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5" : undefined}>
      <CardContent className={compact ? "pt-4 pb-4" : "pt-6"}>
        <div className={compact ? "text-xl font-bold" : "text-2xl font-bold"}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{title}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function TargetRow({
  label,
  current,
  target,
  progress,
  detail,
}: {
  label: string;
  current: string;
  target: string;
  progress: number;
  detail: string;
}) {
  const pct = Math.round(progress * 100);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">{current}</span>
          {" / "}
          {target}
          <Badge variant="secondary" className="ms-2">
            {pct}%
          </Badge>
        </p>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
