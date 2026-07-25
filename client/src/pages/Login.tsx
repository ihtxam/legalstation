import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, ArrowRight, Building2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { isOAuthConfigured, safeNextPath, startOAuthLogin } from "@/const";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type TenantInfo =
  | { mode: "platform"; appName: string }
  | {
      mode: "firm";
      name: string;
      slug: string;
      logoUrl?: string | null;
      primaryColor?: string | null;
    };

export default function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const firmHint = params.get("firm");
  const nextPath = safeNextPath(params.get("next"));
  const oauthEnabled = isOAuthConfigured();

  const [email, setEmail] = useState(() => params.get("email")?.trim() || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetch("/api/auth/tenant")
      .then((r) => r.json())
      .then((data) => setTenant(data))
      .catch(() => setTenant({ mode: "platform", appName: "LexFlow" }));
  }, []);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (user.mustChangePassword) {
      setMustChange(true);
      return;
    }
    if (user.role === "superadmin") {
      navigate("/platform/login");
      return;
    }
    navigate(nextPath || "/dashboard");
  }, [isAuthenticated, loading, user, navigate, nextPath]);

  const brandName = tenant?.mode === "firm" ? tenant.name : "LexFlow";
  const primary = tenant?.mode === "firm" && tenant.primaryColor ? tenant.primaryColor : "#001f3f";

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, portal: "app" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("login.loginFailed"));
      await refresh();
      if (data.mustChangePassword) {
        setMustChange(true);
        toast.message(t("login.mustChange"));
        return;
      }
      toast.success(t("login.signedIn"));
      navigate(nextPath || data.redirectTo || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t("login.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("login.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      await refresh();
      toast.success(t("login.passwordUpdated"));
      navigate(nextPath || "/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ backgroundColor: primary }}
          >
            {tenant?.mode === "firm" ? (
              <Building2 className="w-6 h-6 text-white" />
            ) : (
              <Scale className="w-6 h-6 text-white" />
            )}
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">{brandName}</h1>
          <p className="text-muted-foreground text-sm">
            {mustChange ? t("login.changePassword") : t("login.signIn")}
          </p>
          {(firmHint || (tenant?.mode === "firm" && tenant.slug)) && (
            <p className="text-xs text-muted-foreground mt-2">
              Workspace: {firmHint || (tenant as any).slug}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {mustChange ? (
            <form className="space-y-4" onSubmit={onChangePassword}>
              <div>
                <Label htmlFor="newPassword">{t("login.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  className="mt-1.5"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">{t("login.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  className="mt-1.5"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: primary }}
                disabled={busy}
              >
                {busy ? t("common.loading") : t("login.updatePassword")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onLogin}>
              <div>
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  className="mt-1.5"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  className="mt-1.5"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full text-white"
                style={{ backgroundColor: primary }}
                disabled={busy}
              >
                {busy ? t("login.signingIn") : t("login.signIn")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {!mustChange && (
            <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
              {oauthEnabled && (
                <button type="button" className="underline hover:text-foreground" onClick={() => startOAuthLogin()}>
                  {t("login.signInOauth")}
                </button>
              )}
              <div>
                {t("login.platformAdmin")}{" "}
                <a href="/platform/login" className="underline hover:text-foreground">
                  {t("login.superadminLogin")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
