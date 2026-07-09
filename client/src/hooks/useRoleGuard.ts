import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

/**
 * Redirects unauthenticated users to login, and optionally enforces firm membership.
 * @param requireFirmMember - if true, clients (non-firm-members) are redirected to /dashboard
 * @param requireAdmin - if true, only admin role can access; others are redirected to /dashboard
 */
export function useRoleGuard(options: { requireFirmMember?: boolean; requireAdmin?: boolean } = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: firmData, isLoading: firmLoading } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [, navigate] = useLocation();
  const { startLogin } = useAuth() as any;

  useEffect(() => {
    if (authLoading || firmLoading) return;
    if (!isAuthenticated) {
      // Redirect to login
      import("@/const").then(m => m.startLogin());
      return;
    }
    if (options.requireFirmMember && !firmData) {
      navigate("/dashboard");
      return;
    }
    if (options.requireAdmin && firmData?.member?.firmRole !== "admin") {
      navigate("/dashboard");
      return;
    }
  }, [isAuthenticated, authLoading, firmData, firmLoading]);

  return {
    loading: authLoading || firmLoading,
    firmData,
    isFirmMember: !!firmData,
    isAdmin: firmData?.member?.firmRole === "admin",
    isLawyer: firmData?.member?.firmRole === "lawyer",
    isAssistant: firmData?.member?.firmRole === "assistant",
    isClient: !firmData,
  };
}
