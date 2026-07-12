import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
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

function formatCHF(amount: string | number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(amount));
}

interface LineItem {
  description: string;
  billingType: "hourly" | "flat_fee";
  quantity: number;
  unitPrice: number;
}

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
              <Label>Case <span className="text-destructive">*</span></Label>
              <Select value={caseId?.toString() ?? ""} onValueChange={v => setCaseId(parseInt(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select case" /></SelectTrigger>
                <SelectContent>
                  {cases?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>VAT Rate (%)</Label>
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
            <Button size="sm" className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={addItem}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add item
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} className="mt-1" placeholder="e.g., Legal consultation" />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Type</Label>
                  <Select value={item.billingType} onValueChange={v => updateItem(i, "billingType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="flat_fee">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", parseFloat(e.target.value))} className="mt-1" min="0.5" step="0.5" />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Price (CHF)</Label>
                  <Input type="number" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value))} className="mt-1" min="0" step="0.01" />
                </div>
                <button onClick={() => removeItem(i)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT ({vatRate}%)</span>
            <span className="font-medium">{formatCHF(vatAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatCHF(total)}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Notes</h3>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes for the invoice…" />
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
          <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" disabled={!clientId || !caseId || items.length === 0 || createInvoice.isPending}
            onClick={() => createInvoice.mutate({
              clientId: clientId!,
              caseId: caseId!,
              dueDate: dueDate ? new Date(dueDate).getTime() : 0,
              vatRate: parseFloat(vatRate),
              notes,
              items: items.map(i => ({ ...i, unitPrice: typeof i.unitPrice === 'string' ? parseFloat(i.unitPrice) : i.unitPrice })),
            })}>
            Create Invoice
          </Button>
        </div>
      </div>
    </LexLayout>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id);
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => { if (!loading && !isAuthenticated) startLogin(); }, [isAuthenticated, loading]);

  const { data: invoiceData, isLoading, refetch } = trpc.invoices.get.useQuery({ id: invoiceId }, { enabled: isAuthenticated && !isNaN(invoiceId) });
  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Invoice updated"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <LexLayout title="Invoice"><div className="p-6"><Skeleton className="h-64 w-full" /></div></LexLayout>;
  if (!invoiceData) return <LexLayout title="Not Found"><div className="p-6 text-center text-muted-foreground">Invoice not found</div></LexLayout>;

  const invoice = invoiceData;
  const subtotal = invoice.items?.reduce((s: number, i: any) => s + (i.quantity * (typeof i.unitPrice === 'string' ? parseFloat(i.unitPrice) : i.unitPrice)), 0) ?? 0;
  const vatAmount = subtotal * (parseFloat(invoice.vatRate as any) / 100);
  const total = subtotal + vatAmount;

  return (
    <LexLayout breadcrumb={[{ label: "Billing", href: "/invoices" }, { label: `Invoice #${invoice.invoiceNumber}` }]}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Invoice #{invoice.invoiceNumber}</h2>
              <p className="text-sm text-muted-foreground mt-1">Case ID: {invoice.caseId}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Client</p>
              <p className="font-medium text-foreground">Client ID: {invoice.clientId}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium text-foreground">{invoice.dueDate ? format(invoice.dueDate, "dd MMM yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Issued</p>
              <p className="font-medium text-foreground">{format(invoice.createdAt, "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-semibold text-lg text-foreground">{formatCHF(total)}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Line Items</h3>
          <div className="divide-y divide-border">
            {invoice.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.billingType === "hourly" ? `${item.quantity} hours @ ${formatCHF(item.unitPrice)}/hr` : "Flat fee"}</p>
                </div>
                <p className="font-medium text-foreground">{formatCHF(item.quantity * item.unitPrice)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT ({invoice.vatRate}%)</span>
            <span className="font-medium">{formatCHF(vatAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatCHF(total)}</span>
          </div>
        </div>

        {/* Payment section */}
        {invoice.status !== "paid" && (
          <div className="space-y-3">
            <StripePayButton invoiceId={invoiceId} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => {
            const pdfWindow = window.open('', '', 'width=800,height=600');
            if (pdfWindow) {
              pdfWindow.document.write(`
                <html><head><title>Invoice ${invoice.invoiceNumber}</title></head>
                <body onload="window.print()">
                  <h1>Invoice ${invoice.invoiceNumber}</h1>
                  <p>Total: ${formatCHF(total)}</p>
                </body></html>
              `);
              pdfWindow.document.close();
            }
          }}>
            <Download className="w-4 h-4 mr-1.5" /> Download PDF
          </Button>
          {invoice.status === "draft" && (
            <Button className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white" onClick={() => updateStatus.mutate({ id: invoiceId, status: "sent" })}>
              <Send className="w-4 h-4 mr-1.5" /> Send to Client
            </Button>
          )}
          {invoice.status === "paid" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Paid</span>
            </div>
          )}
        </div>
      </div>
    </LexLayout>
  );
}
