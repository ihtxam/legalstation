import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Scale, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const acceptInvite = trpc.firm.acceptInvite.useMutation({
    onSuccess: () => { toast.success("Invitation accepted!"); navigate("/dashboard"); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
    if (!loading && isAuthenticated && token) {
      acceptInvite.mutate({ token });
    }
  }, [isAuthenticated, loading, token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-navy)] mb-4">
          <Scale className="w-6 h-6 text-white" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground mb-2">Joining LexFlow</h1>
        {acceptInvite.isPending && <p className="text-muted-foreground">Processing your invitation…</p>}
        {acceptInvite.isSuccess && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-muted-foreground">You have joined the firm. Redirecting…</p>
          </div>
        )}
        {acceptInvite.isError && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-destructive">{acceptInvite.error?.message}</p>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </div>
        )}
      </div>
    </div>
  );
}
