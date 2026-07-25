import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { canCreateInvoice, isFirmAdminLike } from "@shared/roles";

/**
 * Redirects unauthenticated users to login, and optionally enforces firm membership.
 * @param requireFirmMember - if true, clients (non-firm-members) are redirected to /dashboard
 * @param requireAdmin - if true, only admin/subadmin can access; others are redirected to /dashboard
 */
export function useRoleGuard(options: { requireFirmMember?: boolean; requireAdmin?: boolean } = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: firmData, isLoading: firmLoading } = trpc.firm.myFirm.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [, navigate] = useLocation();
  const role = firmData?.member?.firmRole;

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
    if (options.requireAdmin && !isFirmAdminLike(role)) {
      navigate("/dashboard");
      return;
    }
  }, [isAuthenticated, authLoading, firmData, firmLoading, options.requireFirmMember, options.requireAdmin, role, navigate]);

  return {
    loading: authLoading || firmLoading,
    firmData,
    isFirmMember: !!firmData,
    isAdmin: isFirmAdminLike(role),
    isSubadmin: role === "subadmin",
    isLawyer: role === "lawyer",
    isAssistant: role === "assistant",
    canManageFirm: isFirmAdminLike(role),
    canCreateInvoice: canCreateInvoice(role),
    isClient: !firmData,
  };
}
