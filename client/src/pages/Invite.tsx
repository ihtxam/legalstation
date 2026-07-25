import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Scale, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { setAppLocale } from "@/i18n";
import { isAppLocale } from "@shared/locales";

export default function InvitePage() {
  const { t, i18n } = useTranslation();
  const { token = "" } = useParams<{ token: string }>();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const acceptedOnce = useRef(false);
  const localeApplied = useRef(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const roleLabel = (role: string) => {
    if (role === "subadmin") return t("invite.roleSubadmin");
    if (role === "lawyer") return t("invite.roleLawyer");
    if (role === "assistant") return t("invite.roleAssistant");
    if (role === "client") return t("invite.roleClient");
    return role;
  };

  const inviteQuery = trpc.firm.getInvite.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );

  const acceptInvite = trpc.firm.acceptInvite.useMutation({
    onSuccess: (data) => {
      toast.success(t("invite.accepted"));
      navigate(data.role === "client" ? "/client-portal" : "/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const registerFromInvite = trpc.firm.registerFromInvite.useMutation({
    onSuccess: async (data) => {
      toast.success(t("invite.accountCreated"));
      await refresh();
      navigate(data.redirectTo || "/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  // Prefill UI language from the admin-chosen invite email language (once).
  useEffect(() => {
    if (localeApplied.current) return;
    const lang = inviteQuery.data?.emailLanguage;
    if (lang && isAppLocale(lang)) {
      setAppLocale(lang);
      localeApplied.current = true;
    }
  }, [inviteQuery.data?.emailLanguage]);

  useEffect(() => {
    if (loading || !isAuthenticated || !token || acceptedOnce.current) return;
    if (inviteQuery.data?.expired || inviteQuery.data?.accepted) return;
    acceptedOnce.current = true;
    acceptInvite.mutate({ token });
  }, [isAuthenticated, loading, token, inviteQuery.data?.expired, inviteQuery.data?.accepted]);

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}${
    inviteQuery.data?.email ? `&email=${encodeURIComponent(inviteQuery.data.email)}` : ""
  }`;

  const onCreateAccount = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("invite.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("invite.passwordMismatch"));
      return;
    }
    const preferredLocale = isAppLocale(i18n.language) ? i18n.language : undefined;
    registerFromInvite.mutate({
      token,
      name: name.trim(),
      password,
      preferredLocale,
    });
  };

  if (!token) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive">{t("invite.invalidLink")}</p>
      </CenteredShell>
    );
  }

  if (inviteQuery.isLoading || loading) {
    return (
      <CenteredShell>
        <p className="text-muted-foreground">{t("invite.loading")}</p>
      </CenteredShell>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive mb-4">
          {inviteQuery.error?.message || t("invite.notFound")}
        </p>
        <Button onClick={() => navigate("/")}>{t("invite.goHome")}</Button>
      </CenteredShell>
    );
  }

  const invite = inviteQuery.data;

  if (invite.expired || invite.accepted) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h1 className="font-serif text-2xl font-semibold mb-2">
          {invite.accepted ? t("invite.alreadyUsed") : t("invite.expired")}
        </h1>
        <p className="text-muted-foreground mb-4">
          {t("invite.askAdmin", { email: invite.email })}
        </p>
        <Button onClick={() => navigate("/login")}>{t("invite.signIn")}</Button>
      </CenteredShell>
    );
  }

  if (isAuthenticated) {
    return (
      <CenteredShell>
        <h1 className="font-serif text-2xl font-semibold mb-2">
          {t("invite.joining", { firm: invite.firmName })}
        </h1>
        {acceptInvite.isPending && (
          <p className="text-muted-foreground">
            {t("invite.accepting", { email: user?.email })}
          </p>
        )}
        {acceptInvite.isSuccess && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-muted-foreground">{t("invite.joinedRedirect")}</p>
          </div>
        )}
        {acceptInvite.isError && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-destructive text-sm">{acceptInvite.error?.message}</p>
            <p className="text-sm text-muted-foreground">
              {t("invite.inviteFor", { email: invite.email })}
              {user?.email && user.email.toLowerCase() !== invite.email.toLowerCase()
                ? t("invite.wrongEmail")
                : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                {t("invite.goHome")}
              </Button>
              <Button onClick={() => navigate(loginHref)}>{t("invite.signInInviteEmail")}</Button>
            </div>
          </div>
        )}
      </CenteredShell>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-navy)] mb-4">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
            {t("invite.joinFirm", { firm: invite.firmName })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("invite.invitedAs", { role: roleLabel(invite.role) })}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          {invite.accountExists ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("invite.accountExists", { email: invite.email })}
              </p>
              <Button
                className="w-full bg-[var(--color-navy)] text-white"
                onClick={() => navigate(loginHref)}
              >
                {t("invite.signInToJoin")}
                <ArrowRight className="w-4 h-4 ms-2" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("invite.createToJoin", { role: roleLabel(invite.role) })}
              </p>
              <form className="space-y-4" onSubmit={onCreateAccount}>
                <div>
                  <Label htmlFor="invite-email">{t("invite.email")}</Label>
                  <Input
                    id="invite-email"
                    className="mt-1.5"
                    type="email"
                    value={invite.email}
                    disabled
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="invite-name">{t("invite.fullName")}</Label>
                  <Input
                    id="invite-name"
                    className="mt-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-password">{t("invite.password")}</Label>
                  <Input
                    id="invite-password"
                    className="mt-1.5"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-confirm">{t("invite.confirmPassword")}</Label>
                  <Input
                    id="invite-confirm"
                    className="mt-1.5"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[var(--color-navy)] text-white"
                  disabled={registerFromInvite.isPending}
                >
                  {registerFromInvite.isPending
                    ? t("invite.creatingAccount")
                    : t("invite.createAndJoin", { role: roleLabel(invite.role) })}
                  <ArrowRight className="w-4 h-4 ms-2" />
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground pt-2">
                {t("invite.alreadyHaveAccount")}{" "}
                <Link href={loginHref} className="underline hover:text-foreground">
                  {t("invite.signIn")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md w-full">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-navy)] mb-4">
          <Scale className="w-6 h-6 text-white" />
        </div>
        {children}
      </div>
    </div>
  );
}
