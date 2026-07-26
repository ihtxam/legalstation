import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Briefcase, Receipt, TrendingUp, Clock, AlertTriangle, ArrowRight, Calendar, Crown, BarChart3 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { CASE_TYPE_LABELS } from "@shared/types";
import { format } from "date-fns";
import { PaymentInstallmentTimeline } from "@/components/PaymentInstallmentTimeline";
import { toast } from "sonner";

function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}

function LawyerDashboard() {
  const { data: stats, isLoading } = trpc.dashboard.lawyerStats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery();
  const { data: firmData } = trpc.firm.myFirm.useQuery();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = firmData?.member?.firmRole === "admin";

  // Setup superadmin mutation
  const setupSuperadminMutation = trpc.superadmin.setupSuperadmin.useMutation({
    onSuccess: () => {
      toast.success("You have been promoted to superadmin!");
      setTimeout(() => navigate("/superadmin"), 1000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to setup superadmin");
    },
  });

  // Check if user is admin but not superadmin (eligible for setup)
  const canSetupSuperadmin = user?.role === "admin";

  const statCards = [
    { label: "Open Cases", value: stats?.openCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Cases", value: stats?.pendingCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Pending Invoices", value: stats?.pendingInvoices ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Setup Superadmin Card */}
      {canSetupSuperadmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">Become a Superadmin</p>
                  <p className="text-sm text-amber-800">Manage all firms, subscriptions, and platform settings</p>
                </div>
              </div>
              <Button
                onClick={() => setupSuperadminMutation.mutate()}
                disabled={setupSuperadminMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {setupSuperadminMutation.isPending ? "Setting up..." : "Activate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
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

      {isAdmin && (
        <Card className="border-border shadow-none">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[var(--color-navy)]" />
              <div>
                <p className="font-medium text-foreground">Firm analytics</p>
                <p className="text-sm text-muted-foreground">Revenue trends, case mix, and invoice status</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/analytics")}>
              Open <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{formatCHF(stats?.totalRevenue ?? 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Upcoming deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !stats?.upcomingDeadlines?.length ? (
              <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
            ) : (
              stats.upcomingDeadlines.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="w-full text-left flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {CASE_TYPE_LABELS[c.type as keyof typeof CASE_TYPE_LABELS] || c.type}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {c.deadline ? format(new Date(c.deadline), "dd MMM yyyy") : "—"}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !activity?.length ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            activity.slice(0, 10).map(({ event, case: c }) => (
              <button
                key={event.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                className="w-full text-left flex items-start justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{event.content || event.eventType}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(event.createdAt), "dd MMM")}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientDashboard() {
  const { data: stats, isLoading } = trpc.dashboard.clientStats.useQuery();
  const { data: invoices } = trpc.invoices.list.useQuery();
  const [, navigate] = useLocation();

  // Get payment plans for first outstanding invoice
  // Note: invoices list returns different structures for firm members vs clients
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
          { label: "My Cases", value: stats?.totalCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", href: "/cases" },
          { label: "Open Cases", value: stats?.openCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", href: "/cases" },
          { label: "Unread Messages", value: stats?.unreadMessages ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50", href: "/messages" },
          { label: "Outstanding Bills", value: stats?.pendingInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", href: "/invoices" },
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
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-800">Outstanding Balance</p>
              <p className="text-amber-700 text-2xl font-bold font-serif mt-1">{formatCHF(stats.outstandingBalance)}</p>
            </div>
            <Button className="bg-amber-700 hover:bg-amber-800 text-white" onClick={() => navigate("/invoices")}>
              View invoices <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment Plan Timeline for first outstanding invoice */}
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
  }, [firmData, firmLoading, loading, isAuthenticated]);

  // Don't render any dashboard until we know the user's status
  if (loading || firmLoading || !isAuthenticated) return null;

  const isFirmMember = firmData !== null && firmData !== undefined;

  return (
    <LexLayout title="Dashboard">
      {isFirmMember ? <LawyerDashboard /> : <ClientDashboard />}
    </LexLayout>
  );
}
