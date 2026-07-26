import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { BriefcaseBusiness, Plus, Check, X, UserPlus, Pencil } from "lucide-react";
import { useLocation } from "wouter";

type ServiceForm = {
  name: string;
  description: string;
  category: "advice" | "contract" | "documents" | "employment" | "corporate" | "other";
  price: string;
  estimatedHours: string;
  deliveryNotes: string;
  isPublic: boolean;
};

const emptyService: ServiceForm = {
  name: "",
  description: "",
  category: "advice",
  price: "150",
  estimatedHours: "1",
  deliveryNotes: "",
  isPublic: true,
};

type ServiceRow = {
  id: number;
  name: string;
  description: string | null;
  category: ServiceForm["category"];
  price: string;
  estimatedHours: string;
  deliveryNotes: string | null;
  isActive: boolean;
  isPublic: boolean;
};

export default function FirmServicesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const services = trpc.ondemandServices.listForFirm.useQuery(undefined, {
    enabled: isAuthenticated && !!firmData,
  });
  const orders = trpc.ondemandServices.listOrdersForFirm.useQuery(undefined, {
    enabled: isAuthenticated && !!firmData,
  });
  const members = trpc.firm.members.useQuery(undefined, {
    enabled: isAuthenticated && !!firmData,
  });
  const createSvc = trpc.ondemandServices.createService.useMutation({
    onSuccess: async () => {
      toast.success(t("services.created"));
      closeDialog();
      await services.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSvc = trpc.ondemandServices.updateService.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(t("services.updated"));
      if (variables.name != null) closeDialog();
      await services.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const acceptOrder = trpc.ondemandServices.acceptOrder.useMutation({
    onSuccess: async (res) => {
      toast.success(t("services.accepted"));
      await orders.refetch();
      if (res.caseId) navigate(`/cases/${res.caseId}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectOrder = trpc.ondemandServices.rejectOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.rejected"));
      await orders.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const assignLawyer = trpc.ondemandServices.assignLawyerToOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.lawyerAssigned"));
      await orders.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = trpc.ondemandServices.markPaid.useMutation({
    onSuccess: async () => {
      toast.success(t("services.markedPaid"));
      await orders.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const completeOrder = trpc.ondemandServices.completeOrder.useMutation({
    onSuccess: async () => {
      toast.success(t("services.completed"));
      await orders.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyService);
  const [acceptFor, setAcceptFor] = useState<number | null>(null);
  const [lawyerId, setLawyerId] = useState<string>("");

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const canManage = Boolean(firmData?.capabilities?.canManageFirmSettings);
  const lawyers = (members.data || []).filter((m) =>
    ["admin", "subadmin", "lawyer"].includes(m.member.firmRole)
  );
  const saving = createSvc.isPending || (updateSvc.isPending && editingId != null);

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyService);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyService);
    setOpen(true);
  }

  function openEdit(svc: ServiceRow) {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      description: svc.description || "",
      category: svc.category,
      price: String(Number(svc.price) || 0),
      estimatedHours: String(Number(svc.estimatedHours) || 0),
      deliveryNotes: svc.deliveryNotes || "",
      isPublic: svc.isPublic,
    });
    setOpen(true);
  }

  function saveService() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      price: parseFloat(form.price) || 0,
      estimatedHours: parseFloat(form.estimatedHours) || 1,
      deliveryNotes: form.deliveryNotes.trim() || undefined,
      isPublic: form.isPublic,
    };
    if (editingId != null) {
      updateSvc.mutate({
        id: editingId,
        ...payload,
        description: form.description.trim() || null,
        deliveryNotes: form.deliveryNotes.trim() || null,
      });
    } else {
      createSvc.mutate(payload);
    }
  }

  if (loading || !firmData) {
    return (
      <AppLayout title={t("services.title")}>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t("services.title")}
      breadcrumb={[
        { label: t("nav.upselling"), href: "/upselling" },
        { label: t("services.title") },
      ]}
    >
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BriefcaseBusiness className="w-5 h-5" />
              {t("services.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("services.firmHint")}</p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 me-1.5" />
              {t("services.create")}
            </Button>
          )}
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">{t("services.ordersTab")}</TabsTrigger>
            <TabsTrigger value="catalog">{t("services.catalogTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3 mt-4">
            {(orders.data || []).length === 0 ? (
              <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
                {t("services.noOrders")}
              </div>
            ) : (
              (orders.data || []).map(({ order, client, items }) => (
                <div key={order.id} className="border border-border rounded-xl p-4 bg-card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {order.orderNumber}{" "}
                        <Badge variant="outline" className="ms-1 capitalize">
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {client.companyName ||
                          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
                          client.email}{" "}
                        · {Number(order.subtotal).toFixed(2)} {order.currency}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status === "pending_payment" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid.mutate({ orderId: order.id })}>
                          {t("services.markPaid")}
                        </Button>
                      )}
                      {["paid", "awaiting_acceptance"].includes(order.status) && (
                        <>
                          <Button size="sm" onClick={() => setAcceptFor(order.id)}>
                            <Check className="w-3.5 h-3.5 me-1" />
                            {t("services.accept")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectOrder.mutate({ orderId: order.id })}
                          >
                            <X className="w-3.5 h-3.5 me-1" />
                            {t("services.reject")}
                          </Button>
                        </>
                      )}
                      {order.caseId && ["accepted", "in_progress"].includes(order.status) && !order.assignedLawyerUserId && (
                        <Button size="sm" variant="outline" onClick={() => setAcceptFor(order.id)}>
                          <UserPlus className="w-3.5 h-3.5 me-1" />
                          {t("services.assignLawyer")}
                        </Button>
                      )}
                      {order.caseId && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/cases/${order.caseId}`)}>
                          {t("services.openCase")}
                        </Button>
                      )}
                      {["accepted", "in_progress"].includes(order.status) && (
                        <Button size="sm" variant="outline" onClick={() => completeOrder.mutate({ orderId: order.id })}>
                          {t("services.complete")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="text-sm space-y-1">
                    {items.map((item) => (
                      <li key={item.id}>
                        {item.serviceName} × {item.quantity} · {item.estimatedHours}h
                        {item.clientBrief ? (
                          <span className="text-muted-foreground"> — {item.clientBrief}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {order.clientNotes ? (
                    <p className="text-xs text-muted-foreground">{t("services.clientNotes")}: {order.clientNotes}</p>
                  ) : null}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="catalog" className="space-y-3 mt-4">
            {(services.data || []).length === 0 ? (
              <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
                {t("services.empty")}
              </div>
            ) : (
              (services.data || []).map((svc) => (
                <div key={svc.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{svc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {Number(svc.price).toFixed(2)} {svc.currency} · {svc.estimatedHours}h ·{" "}
                        {t(`services.cat.${svc.category}`)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant={svc.isActive ? "default" : "secondary"}>
                        {svc.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                      {canManage && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(svc)}>
                            <Pencil className="w-3.5 h-3.5 me-1.5" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateSvc.mutate({ id: svc.id, isActive: !svc.isActive })}
                          >
                            {svc.isActive ? t("packages.deactivate") : t("packages.activate")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {svc.description ? (
                    <p className="text-sm text-muted-foreground">{svc.description}</p>
                  ) : null}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) closeDialog();
          else setOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId != null ? t("services.edit") : t("services.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("services.name")}</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("services.namePlaceholder")}
              />
            </div>
            <div>
              <Label>{t("services.description")}</Label>
              <Textarea
                className="mt-1.5"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("packages.price")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("services.estimatedHours")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.estimatedHours}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("services.category")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ServiceForm["category"] }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["advice", "contract", "documents", "employment", "corporate", "other"] as const).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {t(`services.cat.${c}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("services.deliveryNotes")}</Label>
              <Textarea
                className="mt-1.5"
                value={form.deliveryNotes}
                onChange={(e) => setForm((f) => ({ ...f, deliveryNotes: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("packages.public")}</Label>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!form.name.trim() || saving} onClick={saveService}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={acceptFor != null}
        onOpenChange={(v) => {
          if (!v) {
            setAcceptFor(null);
            setLawyerId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("services.acceptTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("services.acceptHint")}</p>
          <div>
            <Label>{t("services.assignLawyerOptional")}</Label>
            <Select value={lawyerId || "none"} onValueChange={(v) => setLawyerId(v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("services.assignLater")}</SelectItem>
                {lawyers.map((m) => (
                  <SelectItem key={m.user.id} value={String(m.user.id)}>
                    {m.user.name || m.user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={acceptOrder.isPending || assignLawyer.isPending || acceptFor == null}
              onClick={() => {
                if (acceptFor == null) return;
                const order = (orders.data || []).find((o) => o.order.id === acceptFor)?.order;
                if (order?.caseId && lawyerId) {
                  assignLawyer.mutate({ orderId: acceptFor, lawyerUserId: Number(lawyerId) });
                  setAcceptFor(null);
                  return;
                }
                acceptOrder.mutate({
                  orderId: acceptFor,
                  lawyerUserId: lawyerId ? Number(lawyerId) : undefined,
                });
                setAcceptFor(null);
                setLawyerId("");
              }}
            >
              {t("services.confirmAccept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
