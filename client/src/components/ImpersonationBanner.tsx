import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ImpersonationBanner() {
  const { data: user, refetch } = trpc.auth.me.useQuery();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const stop = trpc.auth.stopImpersonation.useMutation({
    onSuccess: async (data) => {
      toast.success("Returned to superadmin");
      await utils.invalidate();
      await refetch();
      navigate(data.redirectTo || "/superadmin");
    },
    onError: (e) => toast.error(e.message),
  });

  const info = user?.impersonation;
  if (!info?.active) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex items-center justify-between gap-3 flex-wrap z-50">
      <div className="flex items-center gap-2 min-w-0">
        <Shield className="h-4 w-4 shrink-0" />
        <p className="truncate">
          Viewing as firm admin of <strong>{info.firmName}</strong>
          {info.adminEmail ? ` (${info.adminEmail})` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="bg-white text-amber-950 hover:bg-amber-50 shrink-0"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
      >
        <LogOut className="h-3.5 w-3.5 mr-1.5" />
        {stop.isPending ? "Returning…" : "Return to superadmin"}
      </Button>
    </div>
  );
}
