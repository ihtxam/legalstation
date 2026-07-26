import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Send, CheckCircle, Download, CreditCard, CheckCircle2, Pencil, X } from "lucide-react";
import PaymentPlanScheduler from "@/pages/PaymentPlanScheduler";
import { PaymentInstallmentTimeline } from "@/components/PaymentInstallmentTimeline";
import { useTranslation } from "react-i18next";
function formatCHF(amount: string | number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(Number(amount));
}

interface LineItem {
  description: string;
  billingType: "hourly" | "flat_fee";
  quantity: number;
  unitPrice: number;
}

type InvoiceFormState = {
  clientId: number | null;
  caseId: number | null;
  dueDate: string;
  vatRate: string;
  notes: string;
  items: LineItem[];
};

function clientLabel(c: {
  type: string;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return c.type === "company"
    ? c.companyName || "—"
    : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
}

function InvoiceFormFields({
  form,
  setForm,
  clients,
  cases,
}: {
  form: InvoiceFormState;
  setForm: Dispatch<SetStateAction<InvoiceFormState>>;
  clients: Array<{
    id: number;
    type: string;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }> | undefined;
  cases: Array<{ id: number; title: string }> | undefined;
}) {
  const { t } = useTranslation();

  const updateItem = (i: number, field: keyof LineItem, value: string | number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    }));

  const addItem = () =>
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", billingType: "hourly", quantity: 1, unitPrice: 0 }],
    }));

  const removeItem = (i: number) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== i),
    }));

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground">{t("invoiceDetail.title")}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>
              {t("invoiceDetail.client")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.clientId?.toString() ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, clientId: parseInt(v, 10) }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("invoiceDetail.selectClient")} />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {clientLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("invoiceDetail.optionalCase")}</Label>
            <Select
              value={form.caseId?.toString() ?? "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, caseId: v === "none" ? null : parseInt(v, 10) }))
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("invoiceDetail.optionalCase")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("invoiceDetail.optionalCase")}</SelectItem>
                {cases?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("invoiceDetail.dueDate")}</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>{t("invoiceDetail.vatRate")}</Label>
            <Select
              value={form.vatRate}
              onValueChange={(v) => setForm((f) => ({ ...f, vatRate: v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
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
          <h3 className="font-semibold text-foreground">{t("invoiceDetail.lineItems")}</h3>
          <Button
            size="sm"
            className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            onClick={addItem}
          >
            <Plus className="w-3.5 h-3.5 me-1.5" /> {t("invoiceDetail.addLine")}
          </Button>
        </div>
        <div className="space-y-3">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">{t("invoiceDetail.description")}</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                  className="mt-1"
                  placeholder="e.g., Legal consultation"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">{t("common.type")}</Label>
                <Select
                  value={item.billingType}
                  onValueChange={(v) => updateItem(i, "billingType", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="flat_fee">Flat Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20">
                <Label className="text-xs">{t("invoiceDetail.qty")}</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                  className="mt-1"
                  min="0.5"
                  step="0.5"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">{t("invoiceDetail.unitPrice")}</Label>
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                disabled={form.items.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground">{t("invoiceDetail.notes")}</h3>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Additional notes for the invoice…"
        />
      </div>
    </>
  );
}

function formTotals(form: InvoiceFormState) {
  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (parseFloat(form.vatRate) / 100);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

function validateInvoiceForm(form: InvoiceFormState, t: (k: string) => string): string | null {
  if (!form.clientId) return t("invoiceDetail.selectClient");
  if (!form.dueDate) return t("invoiceDetail.dueDate");
  if (!form.items.length) return t("invoiceDetail.lineItems");
  if (form.items.some((i) => !i.description.trim())) return t("invoiceDetail.description");
  if (form.items.some((i) => !(i.quantity > 0) || !(i.unitPrice > 0))) {
    return t("invoiceDetail.unitPrice");
  }
  return null;
}

function toPayloadItems(items: LineItem[]) {
  return items.map((i) => ({
    description: i.description.trim(),
    billingType: i.billingType,
    quantity: i.quantity,
    unitPrice: typeof i.unitPrice === "string" ? parseFloat(i.unitPrice) : i.unitPrice,
  }));
}

function StripePayButton({ invoiceId }: { invoiceId: number }) {
  const { t } = useTranslation();
  const createSession = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.success(t("invoiceDetail.payNow"));
        window.open(data.url, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-blue-900 text-sm">{t("invoiceDetail.payNow")}</p>
        <p className="text-xs text-blue-700 mt-0.5">Secure payment via Stripe. Accepted: Visa, Mastercard, Amex.</p>
      </div>
      <Button
        className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        disabled={createSession.isPending}
        onClick={() => createSession.mutate({ invoiceId })}
      >
        <CreditCard className="w-4 h-4 me-1.5" />
        {createSession.isPending ? t("common.loading") : t("invoiceDetail.payNow")}
      </Button>
    </div>
  );
}

function NewInvoiceForm() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: cases } = trpc.cases.list.useQuery();
  const [form, setForm] = useState<InvoiceFormState>({
    clientId: null,
    caseId: null,
    dueDate: "",
    vatRate: "7.7",
    notes: "",
    items: [{ description: "", billingType: "hourly", quantity: 1, unitPrice: 0 }],
  });
  const [showPreview, setShowPreview] = useState(false);
  const [sendAfterCreate, setSendAfterCreate] = useState(false);
  const sendAfterCreateRef = useRef(false);

  const sendInvoiceEmail = trpc.invoicePdf.sendEmail.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: async (inv) => {
      const shouldSend = sendAfterCreateRef.current;
      sendAfterCreateRef.current = false;
      setSendAfterCreate(false);
      if (!inv?.id) {
        toast.success(t("invoiceDetail.created"));
        return;
      }
      if (shouldSend) {
        try {
          await sendInvoiceEmail.mutateAsync({ invoiceId: inv.id });
          toast.success(t("invoiceDetail.emailSent"));
        } catch {
          toast.success(t("invoiceDetail.created"));
          toast.error(t("invoiceDetail.emailSendFailed"));
        }
      } else {
        toast.success(t("invoiceDetail.created"));
      }
      navigate(`/invoices/${inv.id}`);
    },
    onError: (e) => {
      sendAfterCreateRef.current = false;
      setSendAfterCreate(false);
      toast.error(e.message);
    },
  });

  const { subtotal, vatAmount, total } = formTotals(form);
  const creating = createInvoice.isPending || sendInvoiceEmail.isPending;

  const submit = (andSend = false) => {
    const err = validateInvoiceForm(form, t);
    if (err) {
      toast.error(err);
      return;
    }
    sendAfterCreateRef.current = andSend;
    setSendAfterCreate(andSend);
    createInvoice.mutate({
      clientId: form.clientId!,
      caseId: form.caseId ?? undefined,
      dueDate: new Date(form.dueDate).getTime(),
      vatRate: parseFloat(form.vatRate),
      notes: form.notes || undefined,
      items: toPayloadItems(form.items),
    });
  };

  return (
    <AppLayout
      breadcrumb={[
        { label: t("nav.billing"), href: "/invoices" },
        { label: t("invoiceDetail.newInvoice") },
      ]}
    >
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <InvoiceFormFields form={form} setForm={setForm} clients={clients} cases={cases} />

        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
            <span className="font-medium">{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("invoiceDetail.vat")} ({form.vatRate}%)
            </span>
            <span className="font-medium">{formatCHF(vatAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span>{t("invoiceDetail.total")}</span>
            <span>{formatCHF(total)}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end flex-wrap">
          <Button variant="outline" onClick={() => window.history.back()} disabled={creating}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={creating}>
            Preview
          </Button>
          <Button variant="outline" disabled={creating} onClick={() => submit(false)}>
            {creating && !sendAfterCreate ? t("common.loading") : t("invoiceDetail.create")}
          </Button>
          <Button
            className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            disabled={creating}
            onClick={() => submit(true)}
          >
            <Send className="w-4 h-4 me-1.5" />
            {creating && sendAfterCreate ? t("common.loading") : t("invoiceDetail.createAndSend")}
          </Button>
        </div>

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice Preview</DialogTitle>
            </DialogHeader>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.client")}</p>
                  <p className="font-medium">
                    {clients?.find((c) => c.id === form.clientId)
                      ? clientLabel(clients.find((c) => c.id === form.clientId)!)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.case")}</p>
                  <p className="font-medium">
                    {cases?.find((c) => c.id === form.caseId)?.title || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.dueDate")}</p>
                  <p className="font-medium">
                    {form.dueDate ? format(new Date(form.dueDate), "dd MMM yyyy") : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.vatRate")}</p>
                  <p className="font-medium">{form.vatRate}%</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{t("invoiceDetail.lineItems")}</h4>
                {form.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {item.description} ({item.quantity} × CHF {item.unitPrice})
                    </span>
                    <span className="font-medium">
                      CHF {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
                  <span className="font-medium">{formatCHF(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("invoiceDetail.vat")} ({form.vatRate}%)
                  </span>
                  <span className="font-medium">{formatCHF(vatAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>{t("invoiceDetail.total")}</span>
                  <span>{formatCHF(total)}</span>
                </div>
              </div>
              {form.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t("invoiceDetail.notes")}</p>
                    <p className="text-sm">{form.notes}</p>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="outline"
                disabled={creating}
                onClick={() => {
                  setShowPreview(false);
                  submit(false);
                }}
              >
                {t("invoiceDetail.create")}
              </Button>
              <Button
                className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                disabled={creating}
                onClick={() => {
                  setShowPreview(false);
                  submit(true);
                }}
              >
                <Send className="w-4 h-4 me-1.5" />
                {t("invoiceDetail.createAndSend")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function AdyenPayButton({ invoiceId, existingUrl }: { invoiceId: number; existingUrl?: string | null }) {
  const { t } = useTranslation();
  const createLink = trpc.adyen.createPaymentLink.useMutation({
    onSuccess: (data) => {
      if (data.paymentUrl) {
        toast.success("Redirecting to Adyen…");
        window.open(data.paymentUrl, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-emerald-900 text-sm">Pay with Adyen</p>
        <p className="text-xs text-emerald-700 mt-0.5">Alternative checkout for Swiss cards and local methods.</p>
      </div>
      <Button
        className="bg-emerald-700 hover:bg-emerald-800 text-white shrink-0"
        disabled={createLink.isPending}
        onClick={() => {
          if (existingUrl) window.open(existingUrl, "_blank");
          else createLink.mutate({ invoiceId });
        }}
      >
        <CreditCard className="w-4 h-4 me-1.5" />
        {createLink.isPending ? "Preparing…" : existingUrl ? "Open Adyen link" : "Pay with Adyen"}
      </Button>
    </div>
  );
}

function invoiceToForm(invoice: {
  clientId: number;
  caseId?: number | null;
  dueDate?: Date | string | null;
  vatRate?: string | number | null;
  notes?: string | null;
  items?: Array<{
    description: string;
    billingType: string;
    quantity: string | number;
    unitPrice: string | number;
  }>;
}): InvoiceFormState {
  return {
    clientId: invoice.clientId,
    caseId: invoice.caseId ?? null,
    dueDate: invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : "",
    vatRate: String(invoice.vatRate ?? "7.7"),
    notes: invoice.notes || "",
    items:
      invoice.items && invoice.items.length > 0
        ? invoice.items.map((item) => ({
            description: item.description || "",
            billingType: (item.billingType === "flat_fee" ? "flat_fee" : "hourly") as
              | "hourly"
              | "flat_fee",
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
          }))
        : [{ description: "", billingType: "hourly", quantity: 1, unitPrice: 0 }],
  };
}

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const isNewInvoice = location === "/invoices/new";
  const id = isNewInvoice ? "new" : location.split("/").pop();
  const invoiceId = isNewInvoice ? NaN : parseInt(id || "", 10);
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: branding } = trpc.firm.branding.useQuery(undefined, { enabled: isAuthenticated });
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const isFirmMember = !!firmData;
  const canManageInvoices = Boolean(firmData?.capabilities?.canCreateInvoice);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InvoiceFormState | null>(null);
  const [showPaymentPlanForm, setShowPaymentPlanForm] = useState(false);

  const { data: clients } = trpc.clients.list.useQuery(undefined, {
    enabled: isAuthenticated && isFirmMember,
  });
  const { data: cases } = trpc.cases.list.useQuery(undefined, {
    enabled: isAuthenticated && isFirmMember,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const { data: invoiceData, isLoading, refetch } = trpc.invoices.get.useQuery(
    { id: invoiceId },
    { enabled: isAuthenticated && !isNaN(invoiceId) }
  );
  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success(t("invoiceDetail.updated"));
    },
    onError: (e) => toast.error(e.message),
  });
  const sendInvoiceEmail = trpc.invoicePdf.sendEmail.useMutation({
    onSuccess: async () => {
      toast.success(t("invoiceDetail.emailSent"));
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateInvoice = trpc.invoices.update.useMutation({
    onSuccess: async () => {
      toast.success(t("invoiceDetail.saved"));
      setEditing(false);
      setForm(null);
      await refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const generatePdf = trpc.invoicePdf.generate.useMutation({
    onError: (e) => toast.error(e.message || "Failed to generate PDF"),
  });
  const { data: paymentPlans, refetch: refetchPlans } = trpc.paymentPlans.listByInvoice.useQuery(
    { invoiceId },
    { enabled: isAuthenticated && !isNaN(invoiceId) }
  );
  const generateInstallment = trpc.paymentPlans.generateInstallmentInvoice.useMutation({
    onSuccess: () => {
      toast.success("Installment invoice generated");
      void refetchPlans();
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadServerPdf = async () => {
    try {
      const result = await generatePdf.mutateAsync({
        invoiceId,
        includePaymentLink: true,
      });
      const binary = atob(result.buffer);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: result.mimeType || "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (result.includedQrBill) {
        toast.success(t("invoiceDetail.pdfWithQr"));
      } else {
        toast.success(t("invoiceDetail.downloadPdf"));
        const reason = result.qrBillSkipReason as string | null | undefined;
        if (reason === "missing_iban") toast.warning(t("invoiceDetail.qrSkip.missing_iban"));
        else if (reason === "invalid_iban") toast.warning(t("invoiceDetail.qrSkip.invalid_iban"));
        else if (reason === "invalid_qr_iban") toast.warning(t("invoiceDetail.qrSkip.invalid_qr_iban"));
        else if (reason === "render_failed") toast.warning(t("invoiceDetail.qrSkip.render_failed"));
      }
    } catch {
      // toast handled by mutation onError
    }
  };

  if (isNewInvoice) {
    if (!firmData) {
      return (
        <AppLayout title={t("invoiceDetail.title")}>
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </AppLayout>
      );
    }
    if (!canManageInvoices) {
      return (
        <AppLayout title={t("invoiceDetail.title")}>
          <div className="p-6 text-center text-muted-foreground">{t("invoiceDetail.notFound")}</div>
        </AppLayout>
      );
    }
    return <NewInvoiceForm />;
  }
  if (isLoading)
    return (
      <AppLayout title={t("invoiceDetail.title")}>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  if (!invoiceData)
    return (
      <AppLayout title={t("common.notFound")}>
        <div className="p-6 text-center text-muted-foreground">{t("invoiceDetail.notFound")}</div>
      </AppLayout>
    );

  const invoice = invoiceData;
  const canEdit = canManageInvoices && invoice.status === "draft";
  const client = clients?.find((c) => c.id === invoice.clientId);
  const caseRow = cases?.find((c) => c.id === invoice.caseId);

  const startEditing = () => {
    setForm(invoiceToForm(invoice));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm(null);
  };

  const saveEdits = () => {
    if (!form) return;
    const err = validateInvoiceForm(form, t);
    if (err) {
      toast.error(err);
      return;
    }
    updateInvoice.mutate({
      id: invoiceId,
      clientId: form.clientId!,
      caseId: form.caseId,
      dueDate: new Date(form.dueDate).getTime(),
      vatRate: parseFloat(form.vatRate),
      notes: form.notes || "",
      items: toPayloadItems(form.items),
    });
  };

  const displaySubtotal =
    editing && form
      ? formTotals(form).subtotal
      : (invoice.items?.reduce(
          (s: number, i: { quantity: string | number; unitPrice: string | number }) =>
            s + Number(i.quantity) * Number(i.unitPrice),
          0
        ) ?? 0);
  const displayVatRate = editing && form ? form.vatRate : String(invoice.vatRate);
  const displayVatAmount = displaySubtotal * (parseFloat(displayVatRate) / 100);
  const displayTotal = displaySubtotal + displayVatAmount;

  return (
    <AppLayout
      breadcrumb={[
        { label: t("nav.billing"), href: "/invoices" },
        { label: `${t("invoiceDetail.title")} #${invoice.invoiceNumber}` },
      ]}
    >
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4 flex-1">
              {branding?.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt="Firm logo"
                  className="h-12 w-auto object-contain"
                />
              )}
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Invoice #{invoice.invoiceNumber}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {client ? clientLabel(client) : `Client #${invoice.clientId}`}
                  {caseRow ? ` · ${caseRow.title}` : invoice.caseId ? ` · Case #${invoice.caseId}` : ""}
                </p>
              </div>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          {!editing && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Firm</p>
                  <p className="font-medium text-foreground">{branding?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{branding?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.dueDate")}</p>
                  <p className="font-medium text-foreground">
                    {invoice.dueDate ? format(invoice.dueDate, "dd MMM yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Issued</p>
                  <p className="font-medium text-foreground">
                    {format(invoice.createdAt, "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("invoiceDetail.total")}</p>
                  <p className="font-semibold text-lg text-foreground">{formatCHF(displayTotal)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {editing && form ? (
          <>
            <InvoiceFormFields
              form={form}
              setForm={(next) =>
                setForm((prev) => {
                  const base = prev ?? form;
                  return typeof next === "function" ? next(base) : next;
                })
              }
              clients={clients}
              cases={cases}
            />
            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
                <span className="font-medium">{formatCHF(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("invoiceDetail.vat")} ({displayVatRate}%)
                </span>
                <span className="font-medium">{formatCHF(displayVatAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("invoiceDetail.total")}</span>
                <span>{formatCHF(displayTotal)}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={cancelEditing} disabled={updateInvoice.isPending}>
                <X className="w-4 h-4 me-1.5" />
                {t("common.cancel")}
              </Button>
              <Button
                className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                disabled={updateInvoice.isPending}
                onClick={saveEdits}
              >
                {updateInvoice.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">{t("invoiceDetail.lineItems")}</h3>
              <div className="divide-y divide-border">
                {invoice.items?.map(
                  (
                    item: {
                      description: string;
                      billingType: string;
                      quantity: string | number;
                      unitPrice: string | number;
                    },
                    i: number
                  ) => (
                    <div key={i} className="flex justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.billingType === "hourly"
                            ? `${item.quantity} hours @ ${formatCHF(item.unitPrice)}/hr`
                            : "Flat fee"}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatCHF(Number(item.quantity) * Number(item.unitPrice))}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
                <span className="font-medium">{formatCHF(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("invoiceDetail.vat")} ({invoice.vatRate}%)
                </span>
                <span className="font-medium">{formatCHF(displayVatAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("invoiceDetail.total")}</span>
                <span>{formatCHF(displayTotal)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-2">{t("invoiceDetail.notes")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            {invoice.status === "sent" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 text-sm">{t("invoiceDetail.sentBanner")}</p>
                    <p className="text-xs text-blue-700 mt-0.5">{t("invoiceDetail.sentBannerHint")}</p>
                  </div>
                </div>
              </div>
            )}

            {paymentPlans && paymentPlans.length > 0 ? (
              <div className="space-y-4">
                {paymentPlans.map((plan) => (
                  <PaymentInstallmentTimeline
                    key={plan.id}
                    invoiceNumber={invoice.invoiceNumber}
                    totalAmount={parseFloat(String(plan.totalAmount))}
                    generatingId={
                      isFirmMember && generateInstallment.isPending
                        ? generateInstallment.variables?.installmentId ?? null
                        : null
                    }
                    onGenerateInvoice={
                      isFirmMember
                        ? (installmentId) => generateInstallment.mutate({ installmentId })
                        : undefined
                    }
                    installments={(plan.installments || []).map((inst) => {
                      const due = new Date(inst.dueDate);
                      const daysFromNow = Math.ceil(
                        (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      return {
                        id: inst.id,
                        installmentNumber: inst.installmentNumber,
                        amount: parseFloat(String(inst.amount)),
                        status: inst.status,
                        dueDate: due,
                        daysFromNow,
                        generatedInvoiceId: inst.generatedInvoiceId,
                      };
                    })}
                  />
                ))}
              </div>
            ) : isFirmMember && canManageInvoices ? (
              showPaymentPlanForm ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPaymentPlanForm(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                  <PaymentPlanScheduler
                    invoiceId={invoiceId}
                    totalAmount={displayTotal}
                    onCreated={() => {
                      setShowPaymentPlanForm(false);
                      void refetchPlans();
                    }}
                  />
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {t("invoiceDetail.paymentPlanOptional")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("invoiceDetail.paymentPlanOptionalHint")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setShowPaymentPlanForm(true)}
                  >
                    {t("invoiceDetail.createPaymentPlan")}
                  </Button>
                </div>
              )
            ) : null}

            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
              <div className="space-y-3">
                <StripePayButton invoiceId={invoiceId} />
                <AdyenPayButton
                  invoiceId={invoiceId}
                  existingUrl={invoice.adyenPaymentLinkUrl}
                />
                {invoice.stripePaymentUrl && (
                  <p className="text-xs text-muted-foreground">
                    Stripe link saved for this invoice (also embedded on PDF when available).
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end flex-wrap">
              {canEdit && (
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="w-4 h-4 me-1.5" />
                  {t("invoiceDetail.edit")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={generatePdf.isPending}
                onClick={() => void downloadServerPdf()}
              >
                <Download className="w-4 h-4 me-1.5" />
                {generatePdf.isPending ? t("common.loading") : t("invoiceDetail.downloadPdf")}
              </Button>
              {canManageInvoices && invoice.status === "draft" && (
                <Button
                  className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                  disabled={sendInvoiceEmail.isPending || updateStatus.isPending}
                  onClick={() =>
                    sendInvoiceEmail.mutate(
                      { invoiceId },
                      {
                        onError: () => {
                          // Fall back to status-only send if email fails (e.g. missing client email)
                          updateStatus.mutate({ id: invoiceId, status: "sent" });
                        },
                      }
                    )
                  }
                >
                  <Send className="w-4 h-4 me-1.5" />{" "}
                  {sendInvoiceEmail.isPending ? t("common.loading") : t("invoiceDetail.send")}
                </Button>
              )}
              {invoice.status === "paid" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("common.paid")}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
