import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Receipt, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/utils";

function formatMoney(amount: string | number, currency?: string | null) {
  return formatCurrency(Number(amount), currency || "CHF");
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const showNewInvoice = Boolean(firmData?.capabilities?.canCreateInvoice);

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery(
    { status: statusFilter !== "all" ? statusFilter as any : undefined },
    { enabled: isAuthenticated }
  );

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const allInvoices = Array.isArray(invoices)
    ? invoices.map((r: any) => r.invoice ? r : { invoice: r, client: null })
    : [];

  return (
    <AppLayout title={t("invoices.billing")} breadcrumb={[{ label: t("invoices.billing") }]}>
      <div className="page-shell max-w-6xl">
        <div className="page-header">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t("invoices.title")}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{t("invoices.count", { count: allInvoices.length })}</p>
          </div>
          {showNewInvoice && (
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white w-full sm:w-auto" onClick={() => navigate("/invoices/new")}>
              <Plus className="w-4 h-4 mr-1.5" /> {t("invoices.new")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
              <SelectItem value="draft">{t("common.draft")}</SelectItem>
              <SelectItem value="sent">{t("common.sent")}</SelectItem>
              <SelectItem value="paid">{t("common.paid")}</SelectItem>
              <SelectItem value="overdue">{t("common.overdue")}</SelectItem>
              <SelectItem value="cancelled">{t("common.cancelled")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">{[1,2,3,4].map(i => <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>)}</div>
          ) : !allInvoices.length ? (
            <div className="py-16 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">{t("invoices.empty")}</p>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("invoices.colInvoice")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("invoices.colClient")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("invoices.colAmount")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("invoices.colStatus")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("invoices.colDue")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allInvoices.map(({ invoice, client }: any) => (
                  <tr key={invoice.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground text-sm font-mono">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{format(invoice.createdAt, "dd MMM yyyy")}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">
                      {client ? (client.companyName ?? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground text-sm">{formatMoney(invoice.total, invoice.currency)}</p>
                      <p className="text-xs text-muted-foreground">{t("invoices.includingVat", { rate: Number(invoice.vatRate) })}</p>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={invoice.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{format(invoice.dueDate, "dd MMM yyyy")}</td>
                    <td className="px-4 py-3.5"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
