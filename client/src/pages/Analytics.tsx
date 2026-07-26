import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Briefcase,
  FileText,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleGuard } from "@/hooks/useRoleGuard";

function formatCHF(amount: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(amount);
}

const CASE_COLORS = ["#1e40af", "#d97706", "#059669", "#6b7280"];
const INVOICE_COLORS = ["#94a3b8", "#6366f1", "#16a34a", "#dc2626", "#9ca3af"];

export default function AnalyticsPage() {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useRoleGuard({ requireFirmMember: true, requireAdmin: true });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data, isLoading } = trpc.dashboard.adminAnalytics.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  const caseChartData = data
    ? Object.entries(data.casesByStatus).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  const invoiceChartData = data
    ? Object.entries(data.invoicesByStatus).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  const summaryCards = [
    { label: "Total Cases", value: data?.totals.cases ?? 0, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Clients", value: data?.totals.clients ?? 0, icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Documents", value: data?.totals.documents ?? 0, icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Revenue (paid)", value: formatCHF(data?.totals.totalRevenue ?? 0), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <LexLayout breadcrumb={[{ label: "Analytics" }]} title="Firm Analytics">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Firm Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of cases, billing, and document activity for your firm.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
                      {label}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                    )}
                  </div>
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && data && (
          <Card className="border-border shadow-none">
            <CardContent className="p-5 flex items-center gap-3">
              <Receipt className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-foreground">Outstanding balance</p>
                <p className="text-lg font-semibold text-red-700">
                  {formatCHF(data.totals.outstanding)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Revenue (last 6 months)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.revenueByMonth ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCHF(value)} />
                    <Bar dataKey="revenue" fill="#001f3f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Cases by status</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : caseChartData.every((d) => d.value === 0) ? (
                <p className="text-sm text-muted-foreground h-full flex items-center justify-center">
                  No cases yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={caseChartData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {caseChartData.filter((d) => d.value > 0).map((_, i) => (
                        <Cell key={i} fill={CASE_COLORS[i % CASE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Invoices by status</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {invoiceChartData.map((_, i) => (
                        <Cell key={i} fill={INVOICE_COLORS[i % INVOICE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </LexLayout>
  );
}
