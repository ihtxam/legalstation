import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Briefcase, Receipt, Clock, AlertTriangle, ArrowRight, Crown } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { PaymentInstallmentTimeline } from "@/components/PaymentInstallmentTimeline";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}

function LawyerDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = trpc.dashboard.lawyerStats.useQuery();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const setupSuperadminMutation = trpc.superadmin.setupSuperadmin.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.promoted"));
      setTimeout(() => navigate("/superadmin"), 1000);
    },
    onError: (err) => {
      toast.error(err.message || t("dashboard.setupFailed"));
    },
  });

  const canSetupSuperadmin = user?.role === "admin";

  const statCards = [
    { label: t("dashboard.openCases"), value: stats?.openCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: t("dashboard.pendingCases"), value: stats?.pendingCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: t("dashboard.pendingInvoices"), value: stats?.pendingInvoices ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50" },
    { label: t("dashboard.overdueInvoices"), value: stats?.overdueInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {canSetupSuperadmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">{t("dashboard.becomeSuperadmin")}</p>
                  <p className="text-sm text-amber-800">{t("dashboard.becomeSuperadminDesc")}</p>
                </div>
              </div>
              <Button
                onClick={() => setupSuperadminMutation.mutate()}
                disabled={setupSuperadminMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {setupSuperadminMutation.isPending ? t("dashboard.settingUp") : t("dashboard.activate")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-border shadow-none">
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
    </div>
  );
}

function ClientDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = trpc.dashboard.clientStats.useQuery();
  const { data: invoices } = trpc.invoices.list.useQuery();
  const [, navigate] = useLocation();

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
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("dashboard.myCases"), value: stats?.totalCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", href: "/cases" },
          { label: t("dashboard.openCases"), value: stats?.openCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", href: "/cases" },
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
              <p className="text-amber-700 text-2xl font-bold font-serif mt-1">{formatCHF(stats.outstandingBalance)}</p>
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

  useEffect(() => {
    if (!loading && !firmLoading && isAuthenticated && firmData === null) {
      navigate("/onboarding");
    }
  }, [firmData, firmLoading, loading, isAuthenticated, navigate]);

  if (loading || firmLoading || !isAuthenticated) return null;

  const isFirmMember = firmData !== null && firmData !== undefined;

  return (
    <LexLayout title={t("dashboard.title")}>
      {isFirmMember ? <LawyerDashboard /> : <ClientDashboard />}
    </LexLayout>
  );
}
