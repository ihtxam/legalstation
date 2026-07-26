import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type BillingInterval = "monthly" | "biannual" | "yearly";

function intervalLabel(interval: BillingInterval, t: (k: string) => string) {
  if (interval === "biannual") return t("packages.biannual");
  if (interval === "yearly") return t("packages.yearly");
  return t("packages.monthly");
}

function priceFor(
  pkg: {
    monthlyPrice?: string | null;
    biannualPrice?: string | null;
    yearlyPrice?: string | null;
    price: string;
    availableIntervals?: BillingInterval[];
    billingInterval: string;
  },
  interval: BillingInterval
) {
  if (interval === "monthly") return Number(pkg.monthlyPrice ?? (pkg.billingInterval === "monthly" ? pkg.price : 0));
  if (interval === "biannual") return Number(pkg.biannualPrice ?? 0);
  return Number(pkg.yearlyPrice ?? (pkg.billingInterval === "yearly" ? pkg.price : 0));
}

function intervalsFor(pkg: {
  availableIntervals?: BillingInterval[];
  monthlyPrice?: string | null;
  biannualPrice?: string | null;
  yearlyPrice?: string | null;
  price: string;
  billingInterval: string;
}): BillingInterval[] {
  if (pkg.availableIntervals?.length) return pkg.availableIntervals;
  const out: BillingInterval[] = [];
  if (priceFor(pkg, "monthly") > 0) out.push("monthly");
  if (priceFor(pkg, "biannual") > 0) out.push("biannual");
  if (priceFor(pkg, "yearly") > 0) out.push("yearly");
  if (!out.length && Number(pkg.price) > 0) {
    out.push(pkg.billingInterval === "yearly" ? "yearly" : "monthly");
  }
  return out;
}

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
  const [billingInterval, setBillingInterval] = useState<BillingInterval | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });

  const selected = (catalog.data?.packages || []).find((p) => p.id === packageId) || null;
  const selectedIntervals = selected ? intervalsFor(selected) : [];

  useEffect(() => {
    if (!selected) {
      setBillingInterval(null);
      return;
    }
    const opts = intervalsFor(selected);
    setBillingInterval((prev) => (prev && opts.includes(prev) ? prev : opts[0] || null));
  }, [packageId, catalog.data?.packages]);

  if (catalog.isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-navy)] p-6">
        <div className="max-w-xl mx-auto bg-card rounded-2xl p-6 border border-border">
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

        <div className="bg-card rounded-2xl p-6 space-y-4 border border-border">
          <h2 className="font-semibold text-lg">{t("packages.choosePlan")}</h2>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("packages.noPublicPackages")}</p>
          ) : (
            packages.map((pkg) => {
              const opts = intervalsFor(pkg);
              return (
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
                    {opts
                      .map((iv) => {
                        const amount = priceFor(pkg, iv);
                        return `${amount.toFixed(2)} ${pkg.currency} / ${intervalLabel(iv, t)}`;
                      })
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(pkg.consultationHoursPerYear ?? pkg.consultationHoursPerPeriod) > 0
                      ? `${t("packages.consultHours", {
                          hours: pkg.consultationHoursPerYear ?? pkg.consultationHoursPerPeriod,
                        })} · `
                      : ""}
                    {(pkg.casesPerYear ?? pkg.casesPerPeriod) > 0
                      ? t("packages.casesPerYear", {
                          count: pkg.casesPerYear ?? pkg.casesPerPeriod,
                        })
                      : ""}
                    {pkg.includedFixedHours > 0
                      ? ` · ${t("packages.fixedHours", { hours: pkg.includedFixedHours })}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("packages.minCommitmentHint")}
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
              );
            })
          )}

          {selected && selectedIntervals.length > 0 ? (
            <div>
              <Label>{t("packages.chooseBilling")}</Label>
              <div className="mt-1.5 grid gap-2">
                {selectedIntervals.map((iv) => {
                  const amount = priceFor(selected, iv);
                  return (
                    <button
                      key={iv}
                      type="button"
                      onClick={() => setBillingInterval(iv)}
                      className={`w-full text-start border rounded-lg px-3 py-2 text-sm ${
                        billingInterval === iv
                          ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5"
                          : "border-border"
                      }`}
                    >
                      {intervalLabel(iv, t)} — {amount.toFixed(2)} {selected.currency}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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
              !billingInterval ||
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
                billingInterval: billingInterval!,
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
