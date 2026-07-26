import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Receipt,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  X,
  UserPlus,
  FolderPlus,
  Timer,
  FilePlus2,
  CalendarClock,
  Activity,
  Rocket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { PaymentInstallmentTimeline } from "@/components/PaymentInstallmentTimeline";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/utils";

function GettingStartedCard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: gs } = trpc.dashboard.gettingStarted.useQuery();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("cliavo.gettingStarted.dismissed") === "1"
  );

  const steps = useMemo(() => {
    if (!gs) return [];
    const isAdmin = ["admin", "subadmin"].includes(gs.firmRole);
    const all = [
      { key: "profile", done: gs.profileCompleted, label: t("dashboard.gsProfile"), desc: t("dashboard.gsProfileDesc"), href: gs.profileCompleted ? "/settings" : "/firm-onboarding", adminOnly: true },
      { key: "branding", done: gs.brandingDone, label: t("dashboard.gsBranding"), desc: t("dashboard.gsBrandingDesc"), href: "/settings", adminOnly: true },
      { key: "client", done: gs.hasClient, label: t("dashboard.gsClient"), desc: t("dashboard.gsClientDesc"), href: "/clients", adminOnly: false },
      { key: "case", done: gs.hasCase, label: t("dashboard.gsCase"), desc: t("dashboard.gsCaseDesc"), href: "/cases", adminOnly: false },
      { key: "time", done: gs.hasTimeEntry, label: t("dashboard.gsTime"), desc: t("dashboard.gsTimeDesc"), href: "/time-reports", adminOnly: false },
      { key: "invoice", done: gs.hasInvoice, label: t("dashboard.gsInvoice"), desc: t("dashboard.gsInvoiceDesc"), href: "/invoices", adminOnly: false },
      { key: "team", done: gs.hasTeam, label: t("dashboard.gsTeam"), desc: t("dashboard.gsTeamDesc"), href: "/settings", adminOnly: true },
      { key: "website", done: gs.hasPublishedPage, label: t("dashboard.gsWebsite"), desc: t("dashboard.gsWebsiteDesc"), href: "/cms", adminOnly: true },
    ];
    return all.filter((s) => isAdmin || !s.adminOnly);
  }, [gs, t]);

  if (!gs || dismissed || steps.length === 0) return null;
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <Card className="border-[var(--color-navy)]/20 shadow-none overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-[var(--color-navy)]/5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-navy)] text-white flex items-center justify-center shrink-0">
              <Rocket className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-tight">{t("dashboard.gettingStartedTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.gettingStartedProgress", { done, total: steps.length })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block w-32 h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-[var(--color-navy)] transition-all"
                style={{ width: `${Math.round((done / steps.length) * 100)}%` }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              aria-label={t("dashboard.gsHide")}
              onClick={() => {
                localStorage.setItem("cliavo.gettingStarted.dismissed", "1");
                setDismissed(true);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {steps.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => navigate(s.href)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                {s.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${s.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {s.label}
                  </span>
                  {!s.done && <span className="block text-xs text-muted-foreground truncate">{s.desc}</span>}
                </span>
                {!s.done && (
                  <span className="text-xs font-medium text-[var(--color-navy)] inline-flex items-center gap-1 shrink-0">
                    {t("dashboard.gsStart")} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  note: "dashboard.activityNote",
  status_change: "dashboard.activityStatusChange",
  document_upload: "dashboard.activityDocument",
  message: "dashboard.activityMessage",
  assignment: "dashboard.activityAssignment",
  deadline: "dashboard.activityDeadline",
  system: "dashboard.activitySystem",
};

function LawyerDashboard() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.lawyerStats.useQuery();
  const { data: activity } = trpc.dashboard.recentActivity.useQuery();

  const statCards = [
    { label: t("dashboard.openCases"), value: stats?.openCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", href: "/cases" },
    { label: t("dashboard.pendingCases"), value: stats?.pendingCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", href: "/cases" },
    { label: t("dashboard.pendingInvoices"), value: stats?.pendingInvoices ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50", href: "/invoices" },
    { label: t("dashboard.overdueInvoices"), value: stats?.overdueInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/invoices" },
  ];

  const quickActions = [
    { label: t("dashboard.qaAddClient"), icon: UserPlus, href: "/clients" },
    { label: t("dashboard.qaNewCase"), icon: FolderPlus, href: "/cases" },
    { label: t("dashboard.qaTrackTime"), icon: Timer, href: "/time-reports" },
    { label: t("dashboard.qaNewInvoice"), icon: FilePlus2, href: "/invoices" },
  ];

  const deadlines = stats?.upcomingDeadlines ?? [];
  const recentEvents = (activity ?? []).slice(0, 8);

  return (
    <div className="page-shell max-w-6xl !space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Card
            key={label}
            className="border-border shadow-none cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => navigate(href)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold text-foreground">{value}</p>}
                </div>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <GettingStartedCard />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          {t("dashboard.quickActions")}
        </p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ label, icon: Icon, href }) => (
            <Button key={label} variant="outline" size="sm" onClick={() => navigate(href)}>
              <Icon className="w-4 h-4 mr-1.5" /> {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-border shadow-none">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-[var(--color-navy)]" /> {t("dashboard.upcomingDeadlines")}
            </h3>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noDeadlines")}</p>
            ) : (
              <ul className="space-y-2">
                {deadlines.map((c: any) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 text-left rounded-lg border border-border px-3 py-2 hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/cases/${c.id}`)}
                    >
                      <span className="text-sm font-medium text-foreground truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(c.deadline).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[var(--color-navy)]" /> {t("dashboard.recentActivity")}
            </h3>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="space-y-2">
                {recentEvents.map((row: any) => (
                  <li key={row.event.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-3 text-left rounded-lg px-3 py-1.5 hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/cases/${row.case.id}`)}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground truncate">
                          {t(ACTIVITY_LABEL_KEYS[row.event.eventType] || "dashboard.activitySystem")}
                          {row.event.title ? ` — ${row.event.title}` : ""}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">{row.case.title}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(row.event.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = trpc.dashboard.clientStats.useQuery();
  const { data: invoices } = trpc.invoices.list.useQuery();
  const { data: branding } = trpc.firm.branding.useQuery();
  const [, navigate] = useLocation();
  const currency = branding?.defaultCurrency || "CHF";
  const money = (n: number) => formatCurrency(n, currency);

  const outstandingInvoices = invoices?.filter(inv => {
    const inv_obj = (inv as any).invoice || inv;
    return inv_obj.status !== "paid";
  }) ?? [];

  const firstOutstandingId = outstandingInvoices.length > 0
    ? ((outstandingInvoices[0] as any).invoice?.id ?? (outstandingInvoices[0] as any)?.id)
    : 0;

  const paymentPlansQuery = trpc.paymentPlans.listByInvoice.useQuery(
    { invoiceId: firstOutstandingId },
    { enabled: firstOutstandingId > 0 }
  );

  return (
    <div className="page-shell max-w-4xl !space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t("dashboard.myCases"), value: stats?.totalCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", href: "/client-portal" },
          { label: t("dashboard.openCases"), value: stats?.openCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", href: "/client-portal" },
          { label: t("dashboard.unreadMessages"), value: stats?.unreadMessages ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50", href: "/messages" },
          { label: t("dashboard.outstandingBills"), value: stats?.pendingInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/invoices" },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Card key={label} className="border-border shadow-none cursor-pointer hover:shadow-sm transition-shadow" onClick={() => navigate(href)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
                  {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-bold text-foreground">{value}</p>}
                </div>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {stats?.outstandingBalance !== undefined && stats.outstandingBalance > 0 && (
        <Card className="border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-amber-800">{t("dashboard.outstandingBalance")}</p>
              <p className="text-amber-700 text-2xl font-bold font-serif mt-1">{money(stats.outstandingBalance)}</p>
            </div>
            <Button className="bg-amber-700 hover:bg-amber-800 text-white" onClick={() => navigate("/invoices")}>
              {t("dashboard.viewInvoices")} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {outstandingInvoices.length > 0 && !paymentPlansQuery.isLoading && paymentPlansQuery.data && paymentPlansQuery.data.length > 0 && (
        <div className="mt-6">
          {paymentPlansQuery.data.map((plan: any) => {
            const invoiceData = outstandingInvoices[0] as any;
            const invoice = invoiceData.invoice || invoiceData;
            const installments = (plan.installments || []).map((inst: any) => ({
              id: inst.id,
              installmentNumber: inst.installmentNumber,
              amount: parseFloat(inst.amount as any),
              daysFromNow: Math.ceil((new Date(inst.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              status: inst.status as "pending" | "paid" | "overdue",
              dueDate: new Date(inst.dueDate),
            }));
            const totalAmount = installments.reduce((sum: number, inst: any) => sum + inst.amount, 0);
            return (
              <PaymentInstallmentTimeline
                key={plan.id}
                invoiceNumber={`#${invoice?.invoiceNumber || "N/A"}`}
                installments={installments}
                totalAmount={totalAmount}
                currency={invoice?.currency || currency}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: firmData, isLoading: firmLoading } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const clientStats = trpc.dashboard.clientStats.useQuery(undefined, {
    enabled: isAuthenticated && !firmLoading && firmData === null,
    retry: false,
  });

  useEffect(() => {
    if (loading || firmLoading || !isAuthenticated || firmData !== null) return;
    if (clientStats.isLoading) return;
    // Clients land on the portal; users with no firm and no client profile set up a firm
    if (clientStats.isSuccess) {
      navigate("/client-portal");
      return;
    }
    navigate("/onboarding");
  }, [
    firmData,
    firmLoading,
    loading,
    isAuthenticated,
    navigate,
    clientStats.isLoading,
    clientStats.isSuccess,
  ]);

  if (loading || firmLoading || !isAuthenticated) return null;
  if (firmData === null && (clientStats.isLoading || clientStats.isSuccess)) return null;

  const isFirmMember = firmData !== null && firmData !== undefined;

  return (
    <AppLayout title={t("dashboard.title")}>
      {isFirmMember ? (
        <LawyerDashboard />
      ) : (
        <ClientDashboard />
      )}
    </AppLayout>
  );
}
