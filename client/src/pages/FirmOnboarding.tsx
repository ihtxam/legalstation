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

const STEPS = [
  { id: 1, title: "Firm profile", icon: Building2 },
  { id: 2, title: "Branding", icon: Palette },
  { id: 3, title: "Currency & tax", icon: Coins },
  { id: 4, title: "Subdomain", icon: Globe },
  { id: 5, title: "Done", icon: Check },
];

export default function FirmOnboardingPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: firmData, isLoading, refetch } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated,
  });
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
  const [primaryColor, setPrimaryColor] = useState("#001f3f");
  const [secondaryColor, setSecondaryColor] = useState("#c9a227");
  const [currency, setCurrency] = useState("CHF");
  const [vatRate, setVatRate] = useState("8.10");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");

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
    setPrimaryColor(f.primaryColor || "#001f3f");
    setSecondaryColor(f.secondaryColor || "#c9a227");
    setCurrency(f.defaultCurrency || "CHF");
    setVatRate(String(f.defaultVatRate || "8.10"));
    setSlug(f.slug || "");
    setCustomDomain(f.customDomain || "");
  }, [firmData, navigate]);

  if (loading || isLoading || !firmData) return null;

  const saveStep = async (next: number, finish = false) => {
    await stepMut.mutateAsync({
      step: finish ? 5 : next,
      finish,
      name: name || undefined,
      address,
      email: email || undefined,
      phone,
      vatNumber,
      logoUrl: logoUrl || null,
      primaryColor,
      secondaryColor,
      defaultCurrency: currency,
      defaultVatRate: parseFloat(vatRate) || 8.1,
      slug: slug || undefined,
      customDomain: customDomain || null,
    });
    await refetch();
    if (finish) {
      toast.success("Onboarding complete");
      navigate("/dashboard");
      return;
    }
    setStep(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground">Welcome to LexFlow</h1>
          <p className="text-muted-foreground mt-1">
            Set up {firmData.firm.name} — branding, billing defaults, and your login subdomain.
          </p>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                step === s.id
                  ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]"
                  : step > s.id
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-white text-muted-foreground border-border"
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.title}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          {step === 1 && (
            <>
              <div>
                <Label>Firm name</Label>
                <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Address</Label>
                <Input className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>VAT / UID</Label>
                <Input className="mt-1.5" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Logo URL</Label>
                <Input
                  className="mt-1.5"
                  placeholder="https://… or upload in Settings later"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Primary color</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input type="color" className="w-14 p-1 h-10" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Accent color</Label>
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
                Preview — {name || "Your firm"}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Default currency</Label>
                <Input className="mt-1.5" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                <p className="text-xs text-muted-foreground mt-1">ISO code, e.g. CHF, EUR, USD</p>
              </div>
              <div>
                <Label>Default VAT rate (%)</Label>
                <Input className="mt-1.5" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Swiss standard MWST is currently 8.1%</p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Label>Subdomain</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.your-domain</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lawyers and clients will sign in at this subdomain once DNS is configured.
                </p>
              </div>
              <div>
                <Label>Custom domain (optional)</Label>
                <Input
                  className="mt-1.5"
                  placeholder="portal.yourfirm.ch"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 5 && (
            <div className="text-center py-6 space-y-3">
              <div className="inline-flex w-12 h-12 rounded-full bg-emerald-100 items-center justify-center">
                <Check className="w-6 h-6 text-emerald-700" />
              </div>
              <h2 className="text-xl font-semibold">You&apos;re ready</h2>
              <p className="text-muted-foreground text-sm">
                Finish to open your firm dashboard. You can change branding and subdomain later in Settings.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={step <= 1 || stepMut.isPending}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
            {step < 5 ? (
              <Button
                className="bg-[var(--color-navy)] text-white"
                disabled={stepMut.isPending || (step === 1 && !name.trim())}
                onClick={() => saveStep(step + 1)}
              >
                Continue <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                className="bg-[var(--color-navy)] text-white"
                disabled={stepMut.isPending}
                onClick={() => saveStep(5, true)}
              >
                Go to dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
