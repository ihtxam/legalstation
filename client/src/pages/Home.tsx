import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Scale, Shield, FileText, MessageSquare, Receipt, Users, ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const features = [
  { icon: Users, title: "Client Management", desc: "Manage individual and corporate clients with full onboarding flows and profile management." },
  { icon: FileText, title: "Case Management", desc: "Track cases with timelines, internal notes, status changes, and deadline management." },
  { icon: Shield, title: "Secure Documents", desc: "Upload, version, and share documents with full audit trails and access controls." },
  { icon: MessageSquare, title: "Threaded Messaging", desc: "Communicate per-case with read receipts and email notifications." },
  { icon: Receipt, title: "Swiss Billing", desc: "Generate PDF invoices with CHF billing, VAT/TVA compliance, and Stripe payments." },
  { icon: Scale, title: "Multi-Tenant SaaS", desc: "Fully isolated workspaces per law firm with role-based access control." },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: devLoginEnabled } = trpc.auth.devLoginEnabled.useQuery();
  const utils = trpc.useUtils();
  const [devEmail, setDevEmail] = useState("admin@lexflow.test");
  const devLogin = trpc.auth.devLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Signed in (dev)");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading]);

  // Show nothing while checking auth to avoid flash
  if (loading) return null;
  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-navy)] flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif font-semibold text-xl text-foreground tracking-tight">LexFlow</span>
        </div>
        <Button onClick={() => startLogin()} className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white">
          Sign in
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-navy)] via-[oklch(0.25_0.06_255)] to-[oklch(0.20_0.04_255)]" />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-5xl mx-auto px-8 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)]" />
            Built for Swiss law firms
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-white leading-tight mb-6">
            Legal practice management,<br />
            <span className="text-[var(--color-gold-light)]">refined.</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            LexFlow brings your entire firm into one elegant workspace — cases, clients, documents, billing, and communication, all in one place.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => startLogin()}
              className="bg-white text-[var(--color-navy)] hover:bg-white/90 font-semibold px-8 h-12"
            >
              Get started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {devLoginEnabled ? (
            <form
              className="mt-8 mx-auto max-w-md flex flex-col sm:flex-row gap-3 items-stretch"
              onSubmit={(e) => {
                e.preventDefault();
                devLogin.mutate({ email: devEmail, name: "LexFlow Admin" });
              }}
            >
              <Input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="dev@example.com"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                required
              />
              <Button
                type="submit"
                size="lg"
                disabled={devLogin.isPending}
                className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)] font-semibold"
              >
                {devLogin.isPending ? "Signing in…" : "Dev sign-in"}
              </Button>
            </form>
          ) : null}
          <div className="flex items-center justify-center gap-6 mt-10 text-white/60 text-sm">
            {["CHF billing & VAT", "Stripe payments", "Role-based access"].map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl font-semibold text-foreground mb-3">Everything your firm needs</h2>
          <p className="text-muted-foreground text-lg">A complete platform designed for the precision and confidentiality that legal work demands.</p>
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

      {/* Footer */}
      <footer className="border-t border-border py-8 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            <span className="font-serif font-medium text-foreground">LexFlow</span>
            <span>— Swiss Legal Practice Management</span>
          </div>
          <span>© {new Date().getFullYear()} LexFlow</span>
        </div>
      </footer>
    </div>
  );
}
