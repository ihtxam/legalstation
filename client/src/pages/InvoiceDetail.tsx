import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, FileText, Send, CheckCircle, Download, CreditCard } from "lucide-react";

function StripePayButton({ invoiceId }: { invoiceId: number }) {
  const createSession = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.success("Redirecting to secure payment…");
        window.open(data.url, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-blue-900 text-sm">Pay online with card</p>
        <p className="text-xs text-blue-700 mt-0.5">Secure payment via Stripe. Accepted: Visa, Mastercard, Amex.</p>
      </div>
      <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" disabled={createSession.isPending}
        onClick={() => createSession.mutate({ invoiceId })}>
        <CreditCard className="w-4 h-4 mr-1.5" />
        {createSession.isPending ? "Preparing…" : "Pay now"}
      </Button>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCHF(amount: string | number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(amount));
}

interface LineItem {
  description: string;
  billingType: "hourly" | "flat_fee";
  quantity: number;
  unitPrice: number;
}

function NewInvoiceForm() {
  const [, navigate] = useLocation();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: cases } = trpc.cases.list.useQuery();
  const [clientId, setClientId] = useState<number | null>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState("7.7");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", billingType: "hourly", quantity: 1, unitPrice: 0 }]);

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: (inv) => { toast.success("Invoice created"); navigate(`/invoices/${inv?.id}`); },
    onError: (e) => toast.error(e.message),
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (parseFloat(vatRate) / 100);
  const total = subtotal + vatAmount;

  const addItem = () => setItems(prev => [...prev, { description: "", billingType: "hourly", quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  return (
    <LexLayout breadcrumb={[{ label: "Billing", href: "/invoices" }, { label: "New Invoice" }]}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Invoice Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client <span className="text-destructive">*</span></Label>
              <Select value={clientId?.toString() ?? ""} onValueChange={v => setClientId(parseInt(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.type === "company" ? c.companyName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Case (optional)</Label>
              <Select value={caseId?.toString() ?? "none"} onValueChange={v => setCaseId(v === "none" ? null : parseInt(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Link to case" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No case</SelectItem>
                  {cases?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date <span className="text-destructive">*</span></Label>
              <Input type="date" className="mt-1.5" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>VAT rate (%)</Label>
              <Select value={vatRate} onValueChange={setVatRate}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7.7">7.7% (Standard)</SelectItem>
                  <SelectItem value="3.7">3.7% (Special)</SelectItem>
                  <SelectItem value="2.5">2.5% (Reduced)</SelectItem>
                  <SelectItem value="0">0% (Exempt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Line Items</h3>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3.5 h-3.5 mr-1.5" />Add item</Button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <Label className="text-xs">Description</Label>}
                  <Input className="mt-1" placeholder="Service description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Type</Label>}
                  <Select value={item.billingType} onValueChange={v => updateItem(i, "billingType", v)}>
                    <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="flat_fee">Flat fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Qty / Hours</Label>}
                  <Input type="number" className="mt-1" min="0.01" step="0.25" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Unit price (CHF)</Label>}
                  <Input type="number" className="mt-1" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Amount</Label>}
                  <p className="mt-1 text-sm font-medium text-foreground h-9 flex items-center">{formatCHF(item.quantity * item.unitPrice)}</p>
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors p-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatCHF(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT ({vatRate}%)</span><span>{formatCHF(vatAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground text-base pt-1 border-t border-border">
              <span>Total</span><span className="font-serif">{formatCHF(total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <Label>Notes</Label>
          <Textarea className="mt-1.5" rows={3} placeholder="Payment instructions, bank details, etc." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/invoices")}>Cancel</Button>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            disabled={!clientId || !dueDate || items.some(i => !i.description) || createInvoice.isPending}
            onClick={() => createInvoice.mutate({
              clientId: clientId!, caseId: caseId ?? undefined,
              dueDate: new Date(dueDate).getTime(), vatRate: parseFloat(vatRate),
              notes: notes || undefined, items,
            })}>
            {createInvoice.isPending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </div>
    </LexLayout>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  if (id === "new") return <NewInvoiceForm />;

  const invoiceId = parseInt(id);
  const { data: invoiceData, isLoading, refetch } = trpc.invoices.get.useQuery({ id: invoiceId }, { enabled: isAuthenticated && !isNaN(invoiceId) });
  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Invoice updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <LexLayout title="Invoice"><div className="p-6"><Skeleton className="h-64 w-full" /></div></LexLayout>;
  if (!invoiceData) return <LexLayout title="Not Found"><div className="p-6 text-center text-muted-foreground">Invoice not found</div></LexLayout>;

  const { invoice, items } = invoiceData as any;
  const clientName = invoiceData && (invoiceData as any).client
    ? ((invoiceData as any).client.companyName ?? `${(invoiceData as any).client.firstName ?? ""} ${(invoiceData as any).client.lastName ?? ""}`.trim())
    : "Client";

  return (
    <LexLayout breadcrumb={[{ label: "Billing", href: "/invoices" }, { label: invoice.invoiceNumber }]}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Invoice header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Invoice</p>
              <h2 className="text-2xl font-bold font-serif text-foreground">{invoice.invoiceNumber}</h2>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={invoice.status} />
                <span className="text-sm text-muted-foreground">Due {format(invoice.dueDate, "dd MMMM yyyy")}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold font-serif text-foreground">{formatCHF(invoice.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">incl. {Number(invoice.vatRate)}% VAT</p>
            </div>
          </div>
          <Separator className="my-5" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Billed to</p>
              <p className="font-medium text-foreground">{clientName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Issued</p>
              <p className="font-medium text-foreground">{format(invoice.createdAt, "dd MMMM yyyy")}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(items ?? []).map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-foreground">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{item.billingType.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{Number(item.quantity)}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatCHF(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{formatCHF(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/20">
              <tr>
                <td colSpan={3} />
                <td className="px-4 py-2 text-sm text-muted-foreground text-right">Subtotal</td>
                <td className="px-4 py-2 text-sm text-right font-medium">{formatCHF(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} />
                <td className="px-4 py-2 text-sm text-muted-foreground text-right">VAT ({Number(invoice.vatRate)}%)</td>
                <td className="px-4 py-2 text-sm text-right font-medium">{formatCHF(invoice.vatAmount)}</td>
              </tr>
              <tr className="border-t border-border">
                <td colSpan={3} />
                <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">Total (CHF)</td>
                <td className="px-4 py-3 text-base font-bold text-foreground text-right font-serif">{formatCHF(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {invoice.notes && (
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {invoice.status === "draft" && (
              <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: invoice.id, status: "sent" })}>
                <Send className="w-4 h-4 mr-1.5" /> Send to client
              </Button>
            )}
            {invoice.status === "sent" && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: invoice.id, status: "paid" })}>
                <CheckCircle className="w-4 h-4 mr-1.5" /> Mark as paid
              </Button>
            )}
            {(invoice.status === "sent" || invoice.status === "draft") && (
              <Button variant="outline" disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: invoice.id, status: "overdue" })}>
                Mark overdue
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-1.5" /> Print / PDF
          </Button>
        </div>
        {/* Stripe payment */}
        {(invoice.status === "sent" || invoice.status === "overdue") && (
          <StripePayButton invoiceId={invoice.id} />
        )}
        {/* Payment success/cancel feedback */}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "success" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-emerald-800 font-medium">Payment successful! The invoice will be marked as paid shortly.</p>
          </div>
        )}
      </div>
    </LexLayout>
  );
}
