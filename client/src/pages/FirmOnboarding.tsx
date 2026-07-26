import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Palette, Coins, Globe, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currencyLabel, normalizeCurrency } from "@shared/currencies";
import { useSupportedCurrencies } from "@/hooks/useSupportedCurrencies";

const STEP_META = [
  { id: 1, titleKey: "onboarding.stepFirmProfile" as const, icon: Building2 },
  { id: 2, titleKey: "onboarding.stepBranding" as const, icon: Palette },
  { id: 3, titleKey: "onboarding.stepCurrencyTax" as const, icon: Coins },
  { id: 4, titleKey: "onboarding.stepSubdomain" as const, icon: Globe },
  { id: 5, titleKey: "onboarding.stepDone" as const, icon: Check },
];

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function FirmOnboardingPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: firmData, isLoading, refetch } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: signupInfo } = trpc.signup.info.useQuery();
  const { supportedCurrencies, defaultCurrency: platformDefaultCurrency } = useSupportedCurrencies();
  const baseDomain =
    signupInfo?.appBaseDomain ||
    (typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "platform.com");
  const stepMut = trpc.firm.completeOnboardingStep.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00BFA6");
  const [secondaryColor, setSecondaryColor] = useState("#64748B");
  const [currency, setCurrency] = useState("CHF");
  const [vatRate, setVatRate] = useState("8.10");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!firmData?.firm) return;
    const f = firmData.firm;
    if (f.onboardingCompletedAt) {
      navigate("/dashboard");
      return;
    }
    setStep(Math.max(1, f.onboardingStep || 1));
    setName(f.name || "");
    setAddress(f.address || "");
    setEmail(f.email || "");
    setPhone(f.phone || "");
    setVatNumber(f.vatNumber || "");
    setLogoUrl(f.logoUrl || "");
    setPrimaryColor(f.primaryColor || "#00BFA6");
    setSecondaryColor(f.secondaryColor || "#64748B");
    setCurrency(normalizeCurrency(f.defaultCurrency || platformDefaultCurrency));
    setVatRate(String(f.defaultVatRate || "8.10"));
    setSlug(sanitizeSlug(f.slug || f.name || ""));
  }, [firmData, navigate, platformDefaultCurrency]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {t("onboarding.loading")}
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-serif text-2xl font-semibold">{t("onboarding.noFirmTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("onboarding.noFirmDesc")}</p>
          <Button onClick={() => navigate("/dashboard")}>{t("onboarding.goDashboard")}</Button>
        </div>
      </div>
    );
  }

  const saveStep = async (next: number, finish = false) => {
    const cleanSlug = sanitizeSlug(slug);
    const payload: {
      step: number;
      finish?: boolean;
      name?: string;
      address?: string;
      email?: string;
      phone?: string;
      vatNumber?: string;
      logoUrl?: string | null;
      primaryColor?: string;
      secondaryColor?: string;
      defaultCurrency?: string;
      defaultVatRate?: number;
      slug?: string;
    } = {
      step: finish ? 5 : next,
      finish,
    };

    if (step === 1 || finish) {
      payload.name = name.trim() || undefined;
      payload.address = address;
      payload.email = email.trim() || undefined;
      payload.phone = phone;
      payload.vatNumber = vatNumber;
    }
    if (step === 2 || finish) {
      payload.logoUrl = logoUrl.trim() || null;
      payload.primaryColor = primaryColor;
      payload.secondaryColor = secondaryColor;
    }
    if (step === 3 || finish) {
      payload.defaultCurrency = currency.trim().toUpperCase().slice(0, 3) || "CHF";
      payload.defaultVatRate = parseFloat(vatRate) || 8.1;
    }
    if (step === 4 || finish) {
      if (!cleanSlug) {
        toast.error(t("onboarding.invalidSlug"));
        return;
      }
      payload.slug = cleanSlug;
    }

    try {
      await stepMut.mutateAsync(payload);
      await refetch();
      if (finish) {
        toast.success(t("onboarding.complete"));
        navigate("/dashboard");
        return;
      }
      setStep(next);
    } catch {
      // toast handled by mutation onError
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground">{t("onboarding.welcome")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("onboarding.welcomeSubtitle", { firm: firmData.firm.name })}
          </p>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {STEP_META.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                step === s.id
                  ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]"
                  : step > s.id
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-card text-muted-foreground border-border"
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {t(s.titleKey)}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          {step === 1 && (
            <>
              <div>
                <Label>{t("onboarding.firmName")}</Label>
                <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t("onboarding.address")}</Label>
                <Input className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("onboarding.email")}</Label>
                  <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>{t("onboarding.phone")}</Label>
                  <Input className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>{t("onboarding.vatUid")}</Label>
                <Input className="mt-1.5" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>{t("onboarding.logoUrl")}</Label>
                <Input
                  className="mt-1.5"
                  placeholder={t("onboarding.logoPlaceholder")}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("onboarding.primaryColor")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input type="color" className="w-14 p-1 h-10" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{t("onboarding.accentColor")}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input type="color" className="w-14 p-1 h-10" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  </div>
                </div>
              </div>
              <div
                className="rounded-lg p-4 text-white"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              >
                {t("onboarding.preview", { name: name || t("onboarding.yourFirm") })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>{t("onboarding.defaultCurrency")}</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(normalizeCurrency(v))}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedCurrencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {currencyLabel(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">{t("onboarding.currencyHint")}</p>
              </div>
              <div>
                <Label>{t("onboarding.defaultVat")}</Label>
                <Input className="mt-1.5" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">{t("onboarding.vatHint")}</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Label>{t("onboarding.subdomain")}</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.{baseDomain}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("onboarding.subdomainHint")}{" "}
                  {slug ? (
                    <strong className="text-foreground">
                      {slug}.{baseDomain}
                    </strong>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("onboarding.sitePathHint", {
                    url: slug
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/site/${slug}`
                      : "/site/your-firm",
                  })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">
                {t("onboarding.customDomainLater")}
              </p>
            </>
          )}

          {step === 5 && (
            <div className="text-center py-6 space-y-3">
              <div className="inline-flex w-12 h-12 rounded-full bg-emerald-100 items-center justify-center">
                <Check className="w-6 h-6 text-emerald-700" />
              </div>
              <h2 className="text-xl font-semibold">{t("onboarding.youreReady")}</h2>
              <p className="text-muted-foreground text-sm">{t("onboarding.finishHint")}</p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={step <= 1 || stepMut.isPending}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <ArrowLeft className="w-4 h-4 me-1.5" /> {t("onboarding.back")}
            </Button>
            {step < 5 ? (
              <Button
                className="bg-[var(--color-navy)] text-white"
                disabled={stepMut.isPending || (step === 1 && !name.trim())}
                onClick={() => saveStep(step + 1)}
              >
                {t("onboarding.continue")} <ArrowRight className="w-4 h-4 ms-1.5" />
              </Button>
            ) : (
              <Button
                className="bg-[var(--color-navy)] text-white"
                disabled={stepMut.isPending}
                onClick={() => saveStep(5, true)}
              >
                {t("onboarding.goDashboard")} <ArrowRight className="w-4 h-4 ms-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
