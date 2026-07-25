import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

function roleLabel(role: string) {
  if (role === "lawyer") return "lawyer";
  if (role === "assistant") return "assistant";
  if (role === "client") return "client";
  return role;
}

export default function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const { isAuthenticated, loading, refresh, user } = useAuth();
  const [, navigate] = useLocation();
  const acceptedOnce = useRef(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const inviteQuery = trpc.firm.getInvite.useQuery(
    { token },
    { enabled: Boolean(token), retry: false }
  );

  const acceptInvite = trpc.firm.acceptInvite.useMutation({
    onSuccess: (data) => {
      toast.success("Invitation accepted!");
      navigate(data.role === "client" ? "/client-portal" : "/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const registerFromInvite = trpc.firm.registerFromInvite.useMutation({
    onSuccess: async (data) => {
      toast.success("Account created — welcome aboard!");
      await refresh();
      navigate(data.redirectTo || "/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

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
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    registerFromInvite.mutate({ token, name: name.trim(), password });
  };

  if (!token) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive">Invalid invitation link</p>
      </CenteredShell>
    );
  }

  if (inviteQuery.isLoading || loading) {
    return (
      <CenteredShell>
        <p className="text-muted-foreground">Loading invitation…</p>
      </CenteredShell>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive mb-4">
          {inviteQuery.error?.message || "Invitation not found"}
        </p>
        <Button onClick={() => navigate("/")}>Go home</Button>
      </CenteredShell>
    );
  }

  const invite = inviteQuery.data;

  if (invite.expired || invite.accepted) {
    return (
      <CenteredShell>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h1 className="font-serif text-2xl font-semibold mb-2">
          {invite.accepted ? "Invitation already used" : "Invitation expired"}
        </h1>
        <p className="text-muted-foreground mb-4">
          Ask your firm administrator to send a new invite to {invite.email}.
        </p>
        <Button onClick={() => navigate("/login")}>Sign in</Button>
      </CenteredShell>
    );
  }

  if (isAuthenticated) {
    return (
      <CenteredShell>
        <h1 className="font-serif text-2xl font-semibold mb-2">Joining {invite.firmName}</h1>
        {acceptInvite.isPending && (
          <p className="text-muted-foreground">Accepting invitation as {user?.email}…</p>
        )}
        {acceptInvite.isSuccess && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-muted-foreground">You have joined the firm. Redirecting…</p>
          </div>
        )}
        {acceptInvite.isError && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-destructive text-sm">{acceptInvite.error?.message}</p>
            <p className="text-sm text-muted-foreground">
              This invite is for <strong>{invite.email}</strong>.
              {user?.email && user.email.toLowerCase() !== invite.email.toLowerCase()
                ? " Sign out and use that email, or create a new account."
                : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go home
              </Button>
              <Button onClick={() => navigate(loginHref)}>Sign in with invite email</Button>
            </div>
          </div>
        )}
      </CenteredShell>
    );
  }

  // Unauthenticated: create account (default) or sign in if account already exists
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-navy)] mb-4">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">
            Join {invite.firmName}
          </h1>
          <p className="text-muted-foreground text-sm">
            You&apos;ve been invited as a <strong>{roleLabel(invite.role)}</strong>
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          {invite.accountExists ? (
            <>
              <p className="text-sm text-muted-foreground">
                An account already exists for <strong>{invite.email}</strong>. Sign in to accept
                this invitation.
              </p>
              <Button
                className="w-full bg-[var(--color-navy)] text-white"
                onClick={() => navigate(loginHref)}
              >
                Sign in to join
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Create your LexFlow account to join as a {roleLabel(invite.role)}.
              </p>
              <form className="space-y-4" onSubmit={onCreateAccount}>
                <div>
                  <Label htmlFor="invite-email">Email</Label>
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
                  <Label htmlFor="invite-name">Full name</Label>
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
                  <Label htmlFor="invite-password">Password</Label>
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
                  <Label htmlFor="invite-confirm">Confirm password</Label>
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
                    ? "Creating account…"
                    : `Create account & join as ${roleLabel(invite.role)}`}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{" "}
                <Link href={loginHref} className="underline hover:text-foreground">
                  Sign in
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
