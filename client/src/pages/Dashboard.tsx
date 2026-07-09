import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Briefcase, Receipt, TrendingUp, Clock, AlertTriangle, ArrowRight, Calendar } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { CASE_TYPE_LABELS } from "@shared/types";
import { format } from "date-fns";

function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}

function LawyerDashboard() {
  const { data: stats, isLoading } = trpc.dashboard.lawyerStats.useQuery();
  const { data: activity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery();
  const [, navigate] = useLocation();

  const statCards = [
    { label: "Open Cases", value: stats?.openCases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Cases", value: stats?.pendingCases ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Pending Invoices", value: stats?.pendingInvoices ?? 0, icon: Receipt, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-10 w-32" /> : (
              <p className="text-3xl font-bold text-foreground font-serif">{formatCHF(stats?.totalRevenue ?? 0)}</p>
            )}
            <p className="text-muted-foreground text-xs mt-1">From paid invoices</p>
          </CardContent>
        </Card>

        {/* Upcoming deadlines */}
        <Card className="border-border shadow-none lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Upcoming Deadlines
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/cases")}>View all <ArrowRight className="w-3 h-3 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : stats?.upcomingDeadlines.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {stats?.upcomingDeadlines.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:bg-accent rounded px-2 -mx-2 transition-colors" onClick={() => navigate(`/cases/${c.id}`)}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{CASE_TYPE_LABELS[c.type]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">{format(c.deadline!, "dd MMM yyyy")}</p>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !activity?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-0">
              {activity.slice(0, 10).map(({ event, case: c }) => (
                <div key={event.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-accent rounded px-2 -mx-2 transition-colors" onClick={() => navigate(`/cases/${c.id}`)}>
                  <div className="w-2 h-2 rounded-full bg-[var(--color-navy)] mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground"><span className="font-medium">{c.title}</span> — {event.title ?? event.eventType}</p>
                    {event.content && <p className="text-xs text-muted-foreground truncate mt-0.5">{event.content}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{format(event.createdAt, "dd MMM")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientDashboard() {
  const { data: stats, isLoading } = trpc.dashboard.clientStats.useQuery();
  const [, navigate] = useLocation();

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

  if (loading || firmLoading) return null;

  const isFirmMember = firmData !== null && firmData !== undefined;

  return (
    <LexLayout title="Dashboard">
      {isFirmMember ? <LawyerDashboard /> : <ClientDashboard />}
    </LexLayout>
  );
}
