import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
/**
 * Redirects unauthenticated users to login, and optionally enforces firm membership.
 * @param requireFirmMember - if true, clients (non-firm-members) are redirected to /dashboard
 * @param requireAdmin - if true, only roles with admin-console capability can access
 */
export function useRoleGuard(options: { requireFirmMember?: boolean; requireAdmin?: boolean } = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: firmData, isLoading: firmLoading } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [, navigate] = useLocation();
  const role = firmData?.member?.firmRole;
  const caps = firmData?.capabilities;

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
    if (options.requireAdmin && !caps?.canAccessAdminConsole) {
      navigate("/dashboard");
      return;
    }
  }, [isAuthenticated, authLoading, firmData, firmLoading, options.requireFirmMember, options.requireAdmin, caps?.canAccessAdminConsole, navigate]);

  return {
    loading: authLoading || firmLoading,
    firmData,
    isFirmMember: !!firmData,
    isAdmin: Boolean(caps?.canAccessAdminConsole || caps?.canManageFirmSettings),
    isSubadmin: role === "subadmin",
    isLawyer: role === "lawyer",
    isAssistant: role === "assistant",
    canManageFirm: Boolean(caps?.canManageFirmSettings),
    canCreateInvoice: Boolean(caps?.canCreateInvoice),
    isClient: !firmData,
  };
}
