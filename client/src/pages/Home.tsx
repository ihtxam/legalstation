import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Scale,
  Shield,
  FileText,
  MessageSquare,
  Receipt,
  Users,
  ArrowRight,
  Check,
  Globe,
  Server,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isAppLocale } from "@shared/locales";

type DemoStatus = {
  enabled: boolean;
  users: Array<{ email: string; name: string; openId: string }>;
};

type LeadForm = {
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
};

type TrialForm = {
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
  slug: string;
};

const emptyLead: LeadForm = {
  firmName: "",
  contactName: "",
  email: "",
  phone: "",
  message: "",
};

const emptyTrial: TrialForm = {
  firmName: "",
  contactName: "",
  email: "",
  phone: "",
  password: "",
  slug: "",
};

function previewSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const [demo, setDemo] = useState<DemoStatus>({ enabled: false, users: [] });
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [leadTab, setLeadTab] = useState<"trial" | "demo">("trial");
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);
  const [trialForm, setTrialForm] = useState<TrialForm>(emptyTrial);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: signupInfo } = trpc.signup.info.useQuery();

  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      toast.success(t("home.leadSuccess"));
      setLeadForm(emptyLead);
    },
    onError: (e) => toast.error(e.message || t("home.leadError")),
  });

  const createTrial = trpc.signup.createFirmTrial.useMutation({
    onSuccess: async (data) => {
      toast.success(t("home.trialSuccess", { days: data.trialDays, slug: data.slug }));
      await refresh();
      navigate(data.redirectTo || "/firm-onboarding");
    },
    onError: (e) => toast.error(e.message || t("home.trialError")),
  });

  const effectiveSlug = useMemo(() => {
    if (slugTouched && trialForm.slug.trim()) return previewSlug(trialForm.slug);
    return previewSlug(trialForm.firmName) || "your-firm";
  }, [slugTouched, trialForm.slug, trialForm.firmName]);

  const workspaceHint = useMemo(() => {
    const domain = signupInfo?.appBaseDomain;
    if (domain) return `${effectiveSlug}.${domain}`;
    return `/login?firm=${effectiveSlug}`;
  }, [effectiveSlug, signupInfo?.appBaseDomain]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(user?.role === "superadmin" ? "/superadmin" : "/dashboard");
    }
  }, [isAuthenticated, loading, navigate, user?.role]);

  useEffect(() => {
    fetch("/api/demo/status")
      .then((r) => r.json())
      .then((data: DemoStatus) => setDemo(data))
      .catch(() => undefined);
  }, []);

  const demoLogin = async (email: string) => {
    setDemoBusy(email);
    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Demo login failed");
      await refresh();
      navigate(data?.user?.role === "superadmin" ? "/superadmin" : "/dashboard");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoBusy(null);
    }
  };

  if (loading) return null;
  if (isAuthenticated) return null;

  const trialDays = signupInfo?.trialDays ?? 15;
  const features = [
    { icon: Users, title: t("home.featureClients"), desc: t("home.featureClientsDesc") },
    { icon: FileText, title: t("home.featureCases"), desc: t("home.featureCasesDesc") },
    { icon: Shield, title: t("home.featureDocs"), desc: t("home.featureDocsDesc") },
    { icon: MessageSquare, title: t("home.featureMessages"), desc: t("home.featureMessagesDesc") },
    { icon: Receipt, title: t("home.featureBilling"), desc: t("home.featureBillingDesc") },
    { icon: Scale, title: t("home.featureSaaS"), desc: t("home.featureSaaSDesc") },
  ];

  const pathSteps = [
    {
      icon: Sparkles,
      title: t("home.pathTrialTitle", { days: trialDays }),
      desc: t("home.pathTrialDesc", { days: trialDays }),
    },
    {
      icon: Globe,
      title: t("home.pathWhitelabelTitle"),
      desc: t("home.pathWhitelabelDesc"),
    },
    {
      icon: Server,
      title: t("home.pathOnpremTitle"),
      desc: t("home.pathOnpremDesc"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between gap-2 px-4 sm:px-8 py-4 sm:py-5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif font-semibold text-lg sm:text-xl text-foreground tracking-tight truncate">Cliavo</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={() => navigate("/platform/login")} className="text-muted-foreground hidden sm:inline-flex">
            Platform
          </Button>
          <Button size="sm" onClick={() => startLogin()} className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white">
            {t("home.signIn")}
            <ArrowRight className="w-4 h-4 ml-1.5 hidden sm:inline" />
          </Button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00BFA6] via-[#00A894] to-[#0F766E]" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/80" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 md:py-28 text-center">
          <p className="font-serif text-white/90 text-xl sm:text-2xl md:text-3xl tracking-tight mb-4 sm:mb-6">Cliavo</p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight mb-4 sm:mb-5">
            {t("home.title")}{" "}
            <span className="text-[var(--color-gold-light)]">{t("home.titleAccent")}</span>
          </h1>
          <p className="text-white/70 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed px-1">
            {t("home.subtitleTrial", { days: trialDays })}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={() => {
                document.getElementById("firm-signup")?.scrollIntoView({ behavior: "smooth" });
                setLeadTab("trial");
              }}
              className="bg-white text-[var(--color-navy)] hover:bg-white/90 font-semibold px-8 h-12"
            >
              {t("home.startTrial", { days: trialDays })}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById("firm-signup")?.scrollIntoView({ behavior: "smooth" });
                setLeadTab("demo");
              }}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 h-12 px-8"
            >
              {t("home.requestDemo")}
            </Button>
          </div>
          {demo.enabled && demo.users.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-white/70 text-sm">{t("common.demoLogin")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {demo.users.map((u) => (
                  <Button
                    key={u.openId}
                    variant="outline"
                    size="sm"
                    disabled={demoBusy === u.email}
                    onClick={() => demoLogin(u.email)}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    {demoBusy === u.email ? t("common.loading") : t("common.demoAs", { name: u.name })}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-10 text-white/60 text-sm flex-wrap">
            {[
              t("home.trustTrial", { days: trialDays }),
              t("home.trustSlug"),
              t("home.trustWhitelabel"),
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">{t("home.pathTitle")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("home.pathSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pathSteps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative">
                <div className="text-[var(--color-gold)] font-serif text-sm mb-3">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="w-10 h-10 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[var(--color-navy)]" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">{t("home.featuresTitle")}</h2>
          <p className="text-muted-foreground text-lg">{t("home.featuresSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group p-6 rounded-xl border border-border bg-card hover:shadow-md hover:border-[var(--color-navy)]/20 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center mb-4 group-hover:bg-[var(--color-navy)]/12 transition-colors">
                <Icon className="w-5 h-5 text-[var(--color-navy)]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="firm-signup" className="border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-8 py-20">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">{t("home.leadsTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("home.leadsSubtitleTrial", { days: trialDays })}</p>
          </div>

          <Tabs value={leadTab} onValueChange={(v) => setLeadTab(v as "trial" | "demo")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="trial">{t("home.startTrial", { days: trialDays })}</TabsTrigger>
              <TabsTrigger value="demo">{t("home.requestDemo")}</TabsTrigger>
            </TabsList>

            <TabsContent value="trial">
              <form
                className="bg-card border border-border rounded-xl p-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (signupInfo && !signupInfo.saasEnabled) {
                    toast.error(t("home.trialSaasOnly"));
                    return;
                  }
                  createTrial.mutate({
                    firmName: trialForm.firmName.trim(),
                    contactName: trialForm.contactName.trim(),
                    email: trialForm.email.trim(),
                    phone: trialForm.phone.trim() || undefined,
                    password: trialForm.password,
                    slug: slugTouched ? trialForm.slug.trim() || undefined : undefined,
                    preferredLocale: isAppLocale(i18n.language) ? i18n.language : "en",
                  });
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trialFirmName">{t("home.firmName")}</Label>
                    <Input
                      id="trialFirmName"
                      className="mt-1.5"
                      required
                      value={trialForm.firmName}
                      onChange={(e) => setTrialForm((f) => ({ ...f, firmName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trialContactName">{t("home.contactName")}</Label>
                    <Input
                      id="trialContactName"
                      className="mt-1.5"
                      required
                      value={trialForm.contactName}
                      onChange={(e) => setTrialForm((f) => ({ ...f, contactName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trialEmail">{t("home.workEmail")}</Label>
                    <Input
                      id="trialEmail"
                      type="email"
                      className="mt-1.5"
                      required
                      autoComplete="email"
                      value={trialForm.email}
                      onChange={(e) => setTrialForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trialPhone">{t("home.phoneOptional")}</Label>
                    <Input
                      id="trialPhone"
                      className="mt-1.5"
                      value={trialForm.phone}
                      onChange={(e) => setTrialForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="trialPassword">{t("home.password")}</Label>
                    <Input
                      id="trialPassword"
                      type="password"
                      className="mt-1.5"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={trialForm.password}
                      onChange={(e) => setTrialForm((f) => ({ ...f, password: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t("home.passwordHint")}</p>
                  </div>
                  <div>
                    <Label htmlFor="trialSlug">{t("home.workspaceSlug")}</Label>
                    <Input
                      id="trialSlug"
                      className="mt-1.5"
                      placeholder={previewSlug(trialForm.firmName) || "your-firm"}
                      value={slugTouched ? trialForm.slug : ""}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setTrialForm((f) => ({ ...f, slug: e.target.value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("home.workspacePreview")}:{" "}
                      <span className="font-medium text-foreground">{workspaceHint}</span>
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm text-muted-foreground">
                  {t("home.trialHint", { days: trialDays })}
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                  <p className="text-xs text-muted-foreground">{t("home.trialNoCard")}</p>
                  <Button
                    type="submit"
                    disabled={createTrial.isPending || signupInfo?.saasEnabled === false}
                    className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                  >
                    {createTrial.isPending ? t("common.loading") : t("home.createWorkspace")}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="demo">
              <form
                className="bg-card border border-border rounded-xl p-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitLead.mutate({
                    type: "demo",
                    firmName: leadForm.firmName.trim(),
                    contactName: leadForm.contactName.trim(),
                    email: leadForm.email.trim(),
                    phone: leadForm.phone.trim() || undefined,
                    message: leadForm.message.trim() || undefined,
                  });
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firmName">{t("home.firmName")}</Label>
                    <Input
                      id="firmName"
                      className="mt-1.5"
                      required
                      value={leadForm.firmName}
                      onChange={(e) => setLeadForm((f) => ({ ...f, firmName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactName">{t("home.contactName")}</Label>
                    <Input
                      id="contactName"
                      className="mt-1.5"
                      required
                      value={leadForm.contactName}
                      onChange={(e) => setLeadForm((f) => ({ ...f, contactName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="leadEmail">{t("home.workEmail")}</Label>
                    <Input
                      id="leadEmail"
                      type="email"
                      className="mt-1.5"
                      required
                      value={leadForm.email}
                      onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="leadPhone">{t("home.phoneOptional")}</Label>
                    <Input
                      id="leadPhone"
                      className="mt-1.5"
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="leadMessage">{t("home.messageOptional")}</Label>
                  <Textarea
                    id="leadMessage"
                    className="mt-1.5 min-h-24"
                    placeholder={t("home.demoMessagePlaceholder")}
                    value={leadForm.message}
                    onChange={(e) => setLeadForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                  <p className="text-xs text-muted-foreground">{t("home.leadHint")}</p>
                  <Button
                    type="submit"
                    disabled={submitLead.isPending}
                    className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
                  >
                    {submitLead.isPending ? t("common.loading") : t("home.requestDemo")}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("home.alreadyHaveAccount")}{" "}
            <button
              type="button"
              className="text-[var(--color-navy)] font-medium underline-offset-2 hover:underline"
              onClick={() => startLogin()}
            >
              {t("home.signIn")}
            </button>
          </p>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
              {t("home.whitelabelTitle")}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("home.whitelabelDesc")}</p>
            <p className="text-sm text-muted-foreground">
              {t("home.whitelabelDns", { ip: signupInfo?.customDomainIp || "179.237.107.63" })}
            </p>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
              {t("home.onpremTitle")}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{t("home.onpremDesc")}</p>
            <Button variant="outline" asChild>
              <a href="mailto:corporateshift@gmail.com?subject=Cliavo%20on-premise%20setup">
                {t("home.contactOnprem")}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-muted-foreground text-sm flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            <span className="font-serif font-medium text-foreground">Cliavo</span>
            <span>{t("home.footerTagline")}</span>
          </div>
          <span>© {new Date().getFullYear()} Cliavo</span>
        </div>
      </footer>
    </div>
  );
}
