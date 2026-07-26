import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ImpersonationBanner() {
  const { t } = useTranslation();
  const { data: user, refetch } = trpc.auth.me.useQuery();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const stop = trpc.auth.stopImpersonation.useMutation({
    onSuccess: async (data) => {
      toast.success(t("impersonation.returned"));
      await utils.invalidate();
      await refetch();
      navigate(data.redirectTo || "/superadmin");
    },
    onError: (e) => toast.error(e.message),
  });

  const info = user?.impersonation;
  if (!info?.active) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-3 sm:px-4 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-50 shrink-0">
      <div className="flex items-start sm:items-center gap-2 min-w-0">
        <Shield className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-xs sm:text-sm leading-snug break-words">
          {t("impersonation.viewingAs", { firm: info.firmName })}
          {info.adminEmail ? ` (${info.adminEmail})` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="bg-white text-amber-950 hover:bg-amber-50 shrink-0 w-full sm:w-auto"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
      >
        <LogOut className="h-3.5 w-3.5 me-1.5" />
        {stop.isPending ? t("impersonation.returning") : t("impersonation.returnToSuperadmin")}
      </Button>
    </div>
  );
}
