import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function PlatformLoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [showBootstrap, setShowBootstrap] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role === "superadmin") {
      navigate("/superadmin");
    }
  }, [isAuthenticated, loading, user, navigate]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, portal: "platform" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("platformLogin.loginFailed"));
      await refresh();
      toast.success(t("platformLogin.welcome"));
      navigate("/superadmin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platformLogin.loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onBootstrap = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/bootstrap-superadmin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, bootstrapSecret, name: "Platform Admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("platformLogin.bootstrapFailed"));
      await refresh();
      toast.success(t("platformLogin.superadminCreated"));
      navigate("/superadmin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platformLogin.bootstrapFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 mb-4">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">{t("platformLogin.title")}</h1>
          <p className="text-slate-400 text-sm">{t("platformLogin.subtitle")}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <form className="space-y-4" onSubmit={showBootstrap ? onBootstrap : onLogin}>
            <div>
              <Label htmlFor="email" className="text-slate-300">{t("platformLogin.email")}</Label>
              <Input
                id="email"
                type="email"
                className="mt-1.5 bg-slate-950 border-slate-700 text-slate-100"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">{t("platformLogin.password")}</Label>
              <Input
                id="password"
                type="password"
                className="mt-1.5 bg-slate-950 border-slate-700 text-slate-100"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {showBootstrap && (
              <div>
                <Label htmlFor="secret" className="text-slate-300">{t("platformLogin.bootstrapSecret")}</Label>
                <Input
                  id="secret"
                  type="password"
                  className="mt-1.5 bg-slate-950 border-slate-700 text-slate-100"
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">{t("platformLogin.bootstrapHint")}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950"
              disabled={busy}
            >
              {busy
                ? t("platformLogin.pleaseWait")
                : showBootstrap
                  ? t("platformLogin.createSuperadmin")
                  : t("platformLogin.signIn")}
              <ArrowRight className="w-4 h-4 ms-2" />
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 space-y-2">
            <button
              type="button"
              className="underline hover:text-slate-300"
              onClick={() => setShowBootstrap((v) => !v)}
            >
              {showBootstrap ? t("platformLogin.backToLogin") : t("platformLogin.firstTimeBootstrap")}
            </button>
            <div>
              {t("platformLogin.firmOrClient")}{" "}
              <a href="/login" className="underline hover:text-slate-300">
                {t("platformLogin.useWorkspaceLogin")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
