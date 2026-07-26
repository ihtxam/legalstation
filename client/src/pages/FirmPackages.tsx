import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Package, Plus, Copy, Pencil } from "lucide-react";

type FormState = {
  name: string;
  description: string;
  monthlyPrice: string;
  biannualPrice: string;
  yearlyPrice: string;
  casesPerPeriod: string;
  consultationHoursPerPeriod: string;
  includedFixedHours: string;
  highlightLabel: string;
  featuresText: string;
  isActive: boolean;
  isPublic: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  monthlyPrice: "39",
  biannualPrice: "210",
  yearlyPrice: "390",
  casesPerPeriod: "0",
  consultationHoursPerPeriod: "12",
  includedFixedHours: "0",
  highlightLabel: "Basic",
  featuresText: "12 hours consultation per year\nEmail support",
  isActive: true,
  isPublic: true,
};

function parseFeatures(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPriceList(
  pkg: {
    monthlyPrice?: string | null;
    biannualPrice?: string | null;
    yearlyPrice?: string | null;
    price: string;
    currency: string;
    billingInterval: string;
  },
  t: (key: string) => string
) {
  const parts: string[] = [];
  const monthly = Number(pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : 0));
  const biannual = Number(pkg.biannualPrice ?? 0);
  const yearly = Number(pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : 0));
  if (monthly > 0) parts.push(`${monthly.toFixed(2)} ${pkg.currency}/${t("packages.monthlyShort")}`);
  if (biannual > 0) parts.push(`${biannual.toFixed(2)} ${pkg.currency}/${t("packages.biannualShort")}`);
  if (yearly > 0) parts.push(`${yearly.toFixed(2)} ${pkg.currency}/${t("packages.yearlyShort")}`);
  if (parts.length === 0) {
    parts.push(`${Number(pkg.price).toFixed(2)} ${pkg.currency}`);
  }
  return parts.join(" · ");
}

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
      closeDialog();
      await packages.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updatePkg = trpc.clientPackages.updatePackage.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(t("packages.updated"));
      // Close dialog only after a full edit/save (name present), not activate toggles.
      if (variables.name != null) closeDialog();
      await packages.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  function closeDialog() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(pkg: NonNullable<typeof packages.data>[number]) {
    let features: string[] = [];
    try {
      features = pkg.features ? JSON.parse(pkg.features) : [];
    } catch {
      features = [];
    }
    const monthly = Number(
      pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : 0)
    );
    const biannual = Number(pkg.biannualPrice ?? 0);
    const yearly = Number(
      pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : 0)
    );
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      description: pkg.description || "",
      monthlyPrice: monthly > 0 ? String(monthly) : "",
      biannualPrice: biannual > 0 ? String(biannual) : "",
      yearlyPrice: yearly > 0 ? String(yearly) : "",
      casesPerPeriod: String(pkg.casesPerPeriod ?? 0),
      consultationHoursPerPeriod: String(Number(pkg.consultationHoursPerPeriod || 0)),
      includedFixedHours: String(Number(pkg.includedFixedHours || 0)),
      highlightLabel: pkg.highlightLabel || "",
      featuresText: features.join("\n"),
      isActive: pkg.isActive,
      isPublic: pkg.isPublic,
    });
    setOpen(true);
  }

  function savePackage() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      monthlyPrice: parseFloat(form.monthlyPrice) || 0,
      biannualPrice: form.biannualPrice.trim() ? parseFloat(form.biannualPrice) || 0 : null,
      yearlyPrice: form.yearlyPrice.trim() ? parseFloat(form.yearlyPrice) || 0 : null,
      casesPerPeriod: parseInt(form.casesPerPeriod, 10) || 0,
      consultationHoursPerPeriod: parseFloat(form.consultationHoursPerPeriod) || 0,
      includedFixedHours: parseFloat(form.includedFixedHours) || 0,
      highlightLabel: form.highlightLabel.trim() || undefined,
      features: parseFeatures(form.featuresText),
      isActive: form.isActive,
      isPublic: form.isPublic,
      minCommitmentMonths: 12,
      billingInterval: "monthly" as const,
    };
    if (editingId != null) {
      updatePkg.mutate({ id: editingId, ...payload });
    } else {
      createPkg.mutate(payload);
    }
  }

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

  const saving = createPkg.isPending || updatePkg.isPending;

  return (
    <AppLayout
      title={t("packages.title")}
      breadcrumb={[
        { label: t("nav.upselling"), href: "/upselling" },
        { label: t("packages.title") },
      ]}
    >
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t("packages.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("packages.firmHint")}</p>
          </div>
          <Button onClick={openCreate}>
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
            (packages.data || []).map((pkg) => {
              let features: string[] = [];
              try {
                features = pkg.features ? JSON.parse(pkg.features) : [];
              } catch {
                features = [];
              }
              return (
                <div key={pkg.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {pkg.highlightLabel ? (
                          <Badge variant="outline" className="me-2">
                            {pkg.highlightLabel}
                          </Badge>
                        ) : null}
                        {pkg.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPriceList(pkg, t)}
                        {" · "}
                        {t("packages.casesPerYear", { count: pkg.casesPerPeriod })}
                        {Number(pkg.consultationHoursPerPeriod) > 0
                          ? ` · ${t("packages.consultHours", {
                              hours: Number(pkg.consultationHoursPerPeriod),
                            })}`
                          : ""}
                        {Number(pkg.includedFixedHours) > 0
                          ? ` · ${t("packages.fixedHours", {
                              hours: Number(pkg.includedFixedHours),
                            })}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("packages.minCommitmentHint")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={pkg.isActive ? "default" : "secondary"}>
                        {pkg.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                      <Badge variant="outline">
                        {pkg.isPublic ? t("packages.public") : t("packages.private")}
                      </Badge>
                    </div>
                  </div>
                  {pkg.description ? (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  ) : null}
                  {features.length > 0 ? (
                    <ul className="text-sm text-muted-foreground list-disc ps-5 space-y-0.5">
                      {features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(pkg)}>
                      <Pencil className="w-3.5 h-3.5 me-1.5" />
                      {t("common.edit")}
                    </Button>
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
              );
            })
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
                    <p className="text-muted-foreground capitalize">
                      {subscription.status}
                      {" · "}
                      {subscription.billingInterval === "biannual"
                        ? t("packages.biannual")
                        : subscription.billingInterval === "yearly"
                          ? t("packages.yearly")
                          : t("packages.monthly")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) closeDialog();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId != null ? t("packages.edit") : t("packages.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("packages.name")}</Label>
                <Input
                  className="mt-1.5"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Basic Legal Care"
                />
              </div>
              <div>
                <Label>{t("packages.highlightLabel")}</Label>
                <Input
                  className="mt-1.5"
                  value={form.highlightLabel}
                  onChange={(e) => setForm((f) => ({ ...f, highlightLabel: e.target.value }))}
                  placeholder="Basic / Plus / Premium"
                />
              </div>
            </div>
            <div>
              <Label>{t("packages.description")}</Label>
              <Textarea
                className="mt-1.5"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <p className="text-sm font-medium">{t("packages.pricesTitle")}</p>
              <p className="text-xs text-muted-foreground mb-2">{t("packages.pricesHint")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t("packages.monthlyPrice")} (CHF)</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthlyPrice}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("packages.biannualPrice")} (CHF)</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.biannualPrice}
                    onChange={(e) => setForm((f) => ({ ...f, biannualPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("packages.yearlyPrice")} (CHF)</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.yearlyPrice}
                    onChange={(e) => setForm((f) => ({ ...f, yearlyPrice: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("packages.minCommitmentHint")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t("packages.consultHoursLabel")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.consultationHoursPerPeriod}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, consultationHoursPerPeriod: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{t("packages.casesPerYearLabel")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  value={form.casesPerPeriod}
                  onChange={(e) => setForm((f) => ({ ...f, casesPerPeriod: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("packages.fixedHoursLabel")}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.includedFixedHours}
                  onChange={(e) => setForm((f) => ({ ...f, includedFixedHours: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("packages.featuresLabel")}</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={form.featuresText}
                onChange={(e) => setForm((f) => ({ ...f, featuresText: e.target.value }))}
                placeholder={t("packages.featuresPlaceholder")}
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
            <Button disabled={!form.name.trim() || saving} onClick={savePackage}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
