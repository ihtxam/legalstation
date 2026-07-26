import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function SubscribePage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/subscribe/:firmSlug");
  const [, navigate] = useLocation();
  const firmSlug = params?.firmSlug || "";
  const catalog = trpc.clientPackages.listPublicByFirmSlug.useQuery(
    { firmSlug },
    { enabled: Boolean(firmSlug) }
  );
  const register = trpc.clientPackages.registerSubscriber.useMutation({
    onSuccess: () => {
      toast.success(t("packages.registerSuccess"));
      navigate("/login");
    },
    onError: (e) => toast.error(e.message),
  });

  const [packageId, setPackageId] = useState<number | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });

  if (catalog.isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-navy)] p-6">
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-6">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!catalog.data?.firm) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">{t("packages.firmNotFound")}</p>
      </div>
    );
  }

  const firm = catalog.data.firm;
  const packages = catalog.data.packages;

  return (
    <div className="min-h-screen bg-[var(--color-navy)] p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-white mb-2">
          <h1 className="text-3xl font-bold">{firm.name}</h1>
          <p className="text-white/75 mt-1">{t("packages.subscribeHint")}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">{t("packages.choosePlan")}</h2>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("packages.noPublicPackages")}</p>
          ) : (
            packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setPackageId(pkg.id)}
                className={`w-full text-start border rounded-xl p-4 transition ${
                  packageId === pkg.id
                    ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5"
                    : "border-border hover:border-[var(--color-navy)]/40"
                }`}
              >
                <p className="font-semibold">
                  {pkg.highlightLabel ? `${pkg.highlightLabel} · ` : ""}
                  {pkg.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {Number(pkg.price).toFixed(2)} {pkg.currency} / {pkg.billingInterval}
                  {pkg.consultationHoursPerPeriod > 0
                    ? ` · ${t("packages.consultHours", { hours: pkg.consultationHoursPerPeriod })}`
                    : ""}
                  {pkg.casesPerPeriod > 0
                    ? ` · ${t("packages.casesPerPeriod", { count: pkg.casesPerPeriod })}`
                    : ""}
                  {pkg.includedFixedHours > 0
                    ? ` · ${t("packages.fixedHours", { hours: pkg.includedFixedHours })}`
                    : ""}
                </p>
                {pkg.description ? (
                  <p className="text-sm text-muted-foreground mt-2">{pkg.description}</p>
                ) : null}
                {(pkg.features || []).length > 0 ? (
                  <ul className="text-xs text-muted-foreground mt-2 list-disc ps-4 space-y-0.5">
                    {(pkg.features as string[]).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                ) : null}
              </button>
            ))
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label>{t("packages.firstName")}</Label>
              <Input
                className="mt-1.5"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("packages.lastName")}</Label>
              <Input
                className="mt-1.5"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>{t("common.email")}</Label>
            <Input
              className="mt-1.5"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("packages.password")}</Label>
            <Input
              className="mt-1.5"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("settings.phone")}</Label>
            <Input
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>

          <Button
            className="w-full bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            disabled={
              !packageId ||
              !form.firstName ||
              !form.lastName ||
              !form.email ||
              form.password.length < 8 ||
              register.isPending
            }
            onClick={() =>
              register.mutate({
                firmSlug,
                packageId: packageId!,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                password: form.password,
                phone: form.phone.trim() || undefined,
              })
            }
          >
            {register.isPending ? t("common.loading") : t("packages.createAccount")}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            {t("packages.alreadyHaveAccount")}{" "}
            <a href="/login" className="underline">
              {t("nav.signOut") === "Sign out" ? "Sign in" : t("common.login", { defaultValue: "Sign in" })}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
