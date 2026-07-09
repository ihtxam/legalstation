import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Receipt, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCHF(amount: string | number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(amount));
}

export default function InvoicesPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices, isLoading } = trpc.invoices.list.useQuery(
    { status: statusFilter !== "all" ? statusFilter as any : undefined },
    { enabled: isAuthenticated }
  );

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const allInvoices = Array.isArray(invoices)
    ? invoices.map((r: any) => r.invoice ? r : { invoice: r, client: null })
    : [];

  return (
    <LexLayout title="Billing" breadcrumb={[{ label: "Billing" }]}>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Invoices</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{allInvoices.length} total invoices</p>
          </div>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => navigate("/invoices/new")}>
            <Plus className="w-4 h-4 mr-1.5" /> New invoice
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-border">{[1,2,3,4].map(i => <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>)}</div>
          ) : !allInvoices.length ? (
            <div className="py-16 text-center">
              <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No invoices yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due date</th>
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
                      <p className="font-semibold text-foreground text-sm">{formatCHF(invoice.total)}</p>
                      <p className="text-xs text-muted-foreground">incl. {Number(invoice.vatRate)}% VAT</p>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={invoice.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">{format(invoice.dueDate, "dd MMM yyyy")}</td>
                    <td className="px-4 py-3.5"><ArrowRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </LexLayout>
  );
}
