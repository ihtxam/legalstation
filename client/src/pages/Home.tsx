import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Scale, Shield, FileText, MessageSquare, Receipt, Users, ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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

const emptyLead: LeadForm = {
  firmName: "",
  contactName: "",
  email: "",
  phone: "",
  message: "",
};

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const [demo, setDemo] = useState<DemoStatus>({ enabled: false, users: [] });
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [leadTab, setLeadTab] = useState<"demo" | "signup">("demo");
  const [leadForm, setLeadForm] = useState<LeadForm>(emptyLead);

  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      toast.success(t("home.leadSuccess"));
      setLeadForm(emptyLead);
    },
    onError: (e) => toast.error(e.message || t("home.leadError")),
  });

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

  const features = [
    { icon: Users, title: t("home.featureClients"), desc: t("home.featureClientsDesc") },
    { icon: FileText, title: t("home.featureCases"), desc: t("home.featureCasesDesc") },
    { icon: Shield, title: t("home.featureDocs"), desc: t("home.featureDocsDesc") },
    { icon: MessageSquare, title: t("home.featureMessages"), desc: t("home.featureMessagesDesc") },
    { icon: Receipt, title: t("home.featureBilling"), desc: t("home.featureBillingDesc") },
    { icon: Scale, title: t("home.featureSaaS"), desc: t("home.featureSaaSDesc") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif font-semibold text-xl text-foreground tracking-tight">LexFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/platform/login")} className="text-muted-foreground">
            Platform
          </Button>
          <Button onClick={() => startLogin()} className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white">
            {t("home.signIn")}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-navy)] via-[oklch(0.25_0.06_255)] to-[oklch(0.20_0.04_255)]" />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-5xl mx-auto px-8 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
            {t("home.badge")}
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-white leading-tight mb-6">
            {t("home.title")}<br />
            <span className="text-[var(--color-gold-light)]">{t("home.titleAccent")}</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            {t("home.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={() => {
                document.getElementById("firm-leads")?.scrollIntoView({ behavior: "smooth" });
                setLeadTab("signup");
              }}
              className="bg-white text-[var(--color-navy)] hover:bg-white/90 font-semibold px-8 h-12"
            >
              {t("home.getStarted")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById("firm-leads")?.scrollIntoView({ behavior: "smooth" });
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
            {[t("home.trust1"), t("home.trust2"), t("home.trust3")].map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                {item}
              </span>
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
            <div key={title} className="group p-6 rounded-xl border border-border bg-card hover:shadow-md hover:border-[var(--color-navy)]/20 transition-all duration-200">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-navy)]/8 flex items-center justify-center mb-4 group-hover:bg-[var(--color-navy)]/12 transition-colors">
                <Icon className="w-5 h-5 text-[var(--color-navy)]" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="firm-leads" className="border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-8 py-20">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">
              {t("home.leadsTitle")}
            </h2>
            <p className="text-muted-foreground text-lg">{t("home.leadsSubtitle")}</p>
          </div>

          <Tabs value={leadTab} onValueChange={(v) => setLeadTab(v as "demo" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="demo">{t("home.requestDemo")}</TabsTrigger>
              <TabsTrigger value="signup">{t("home.firmSignup")}</TabsTrigger>
            </TabsList>
            <TabsContent value={leadTab}>
              <form
                className="bg-card border border-border rounded-xl p-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitLead.mutate({
                    type: leadTab,
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
                    placeholder={
                      leadTab === "demo" ? t("home.demoMessagePlaceholder") : t("home.signupMessagePlaceholder")
                    }
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
                    {submitLead.isPending
                      ? t("common.loading")
                      : leadTab === "demo"
                        ? t("home.requestDemo")
                        : t("home.firmSignup")}
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

      <footer className="border-t border-border py-8 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-muted-foreground text-sm flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            <span className="font-serif font-medium text-foreground">LexFlow</span>
            <span>{t("home.footerTagline")}</span>
          </div>
          <span>© {new Date().getFullYear()} LexFlow</span>
        </div>
      </footer>
    </div>
  );
}
