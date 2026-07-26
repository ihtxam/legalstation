import { useState } from "react";
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
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Package, Plus, Copy } from "lucide-react";

type FormState = {
  name: string;
  description: string;
  price: string;
  billingInterval: "monthly" | "yearly";
  casesPerPeriod: string;
  isActive: boolean;
  isPublic: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "0",
  billingInterval: "monthly",
  casesPerPeriod: "1",
  isActive: true,
  isPublic: true,
};

export default function FirmPackagesPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const packages = trpc.clientPackages.listForFirm.useQuery(undefined, {
    enabled: isAuthenticated && !!firmData,
  });
  const subscribers = trpc.clientPackages.listSubscribers.useQuery(undefined, {
    enabled: isAuthenticated && !!firmData?.capabilities?.canManageFirmSettings,
  });
  const createPkg = trpc.clientPackages.createPackage.useMutation({
    onSuccess: async () => {
      toast.success(t("packages.created"));
      setOpen(false);
      setForm(emptyForm);
      await packages.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updatePkg = trpc.clientPackages.updatePackage.useMutation({
    onSuccess: async () => {
      toast.success(t("packages.updated"));
      await packages.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const canManage = Boolean(firmData?.capabilities?.canManageFirmSettings);
  const slug = firmData?.firm?.slug;
  const subscribeUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/subscribe/${slug}`
      : slug
        ? `/subscribe/${slug}`
        : "";

  if (loading || !firmData) {
    return (
      <AppLayout title={t("packages.title")}>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout title={t("packages.title")}>
        <div className="p-6 text-muted-foreground">{t("packages.adminOnly")}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t("packages.title")} breadcrumb={[{ label: t("packages.title") }]}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("packages.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("packages.firmHint")}</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            {t("packages.create")}
          </Button>
        </div>

        {subscribeUrl ? (
          <div className="border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 bg-card">
            <div>
              <p className="font-medium text-sm">{t("packages.publicLink")}</p>
              <p className="text-xs text-muted-foreground break-all">{subscribeUrl}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(subscribeUrl);
                toast.success(t("packages.linkCopied"));
              }}
            >
              <Copy className="w-3.5 h-3.5 me-1.5" />
              {t("packages.copyLink")}
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {(packages.data || []).length === 0 ? (
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground">
              {t("packages.empty")}
            </div>
          ) : (
            (packages.data || []).map((pkg) => (
              <div key={pkg.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Number(pkg.price).toFixed(2)} {pkg.currency} / {pkg.billingInterval} ·{" "}
                      {t("packages.casesPerPeriod", { count: pkg.casesPerPeriod })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={pkg.isActive ? "default" : "secondary"}>
                      {pkg.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                    <Badge variant="outline">{pkg.isPublic ? t("packages.public") : t("packages.private")}</Badge>
                  </div>
                </div>
                {pkg.description ? (
                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updatePkg.mutate({ id: pkg.id, isActive: !pkg.isActive })
                    }
                  >
                    {pkg.isActive ? t("packages.deactivate") : t("packages.activate")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">{t("packages.subscribers")}</h3>
          {(subscribers.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("packages.noSubscribers")}</p>
          ) : (
            <div className="space-y-2">
              {(subscribers.data || []).map(({ subscription, client, package: pkg }) => (
                <div
                  key={subscription.id}
                  className="border border-border rounded-xl p-3 flex flex-wrap justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {client.companyName ||
                        `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
                        client.email}
                    </p>
                    <p className="text-muted-foreground">{client.email}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-medium">{pkg.name}</p>
                    <p className="text-muted-foreground capitalize">{subscription.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("packages.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("packages.name")}</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.description")}</Label>
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
                <Label>{t("packages.casesPerPeriodLabel")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="1"
                  value={form.casesPerPeriod}
                  onChange={(e) => setForm((f) => ({ ...f, casesPerPeriod: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("packages.interval")}</Label>
              <Select
                value={form.billingInterval}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, billingInterval: v as "monthly" | "yearly" }))
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("packages.monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("packages.yearly")}</SelectItem>
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!form.name.trim() || createPkg.isPending}
              onClick={() =>
                createPkg.mutate({
                  name: form.name.trim(),
                  description: form.description.trim() || undefined,
                  price: parseFloat(form.price) || 0,
                  billingInterval: form.billingInterval,
                  casesPerPeriod: parseInt(form.casesPerPeriod, 10) || 1,
                  isActive: form.isActive,
                  isPublic: form.isPublic,
                })
              }
            >
              {createPkg.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
