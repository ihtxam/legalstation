import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, ArrowRight, Building2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { startOAuthLogin } from "@/const";

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
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const firmHint = new URLSearchParams(search).get("firm");

  const [email, setEmail] = useState("");
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
    navigate("/dashboard");
  }, [isAuthenticated, loading, user, navigate]);

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
      if (!res.ok) throw new Error(data.error || "Login failed");
      await refresh();
      if (data.mustChangePassword) {
        setMustChange(true);
        toast.message("Please set a new password to continue");
        return;
      }
      toast.success("Signed in");
      navigate(data.redirectTo || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
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
      toast.success("Password updated");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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
            {mustChange
              ? "Set a new password to finish activating your account"
              : tenant?.mode === "firm"
                ? "Sign in to your firm workspace"
                : "Sign in to LexFlow"}
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
                <Label htmlFor="newPassword">New password</Label>
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
                <Label htmlFor="confirmPassword">Confirm password</Label>
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
                {busy ? "Saving…" : "Save password & continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onLogin}>
              <div>
                <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="password">Password</Label>
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
                {busy ? "Signing in…" : "Sign in"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {!mustChange && (
            <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
              <button type="button" className="underline hover:text-foreground" onClick={() => startOAuthLogin()}>
                Sign in with OAuth
              </button>
              <div>
                Platform admin?{" "}
                <a href="/platform/login" className="underline hover:text-foreground">
                  Superadmin login
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
