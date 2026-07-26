import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "../api/trpc";
import { loginWithPassword, logoutLocal, type LoginUser } from "../api/auth";
import { clearSessionToken, getSessionToken } from "./session";

export type PortalMode = "loading" | "guest" | "firm" | "client" | "platform";

type AuthContextValue = {
  mode: PortalMode;
  user: LoginUser | null;
  meName: string | null;
  firmName: string | null;
  firmRole: string | null;
  isSuperadmin: boolean;
  capabilities: {
    canCreateInvoice: boolean;
    canInviteClients: boolean;
    canSeeFirmWideCases: boolean;
  } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hasToken,
    retry: false,
  });
  const isSuperadmin = meQuery.data?.role === "superadmin";
  const firmQuery = trpc.firm.myFirm.useQuery(undefined, {
    enabled: hasToken && Boolean(meQuery.data) && !isSuperadmin,
    retry: false,
  });

  useEffect(() => {
    void (async () => {
      const token = await getSessionToken();
      setHasToken(Boolean(token));
      setBootstrapped(true);
    })();
  }, []);

  useEffect(() => {
    if (meQuery.isError) {
      void clearSessionToken().then(() => setHasToken(false));
    }
  }, [meQuery.isError]);

  const mode: PortalMode = !bootstrapped
    ? "loading"
    : !hasToken
      ? "guest"
      : meQuery.isLoading || (Boolean(meQuery.data) && !isSuperadmin && firmQuery.isLoading)
        ? "loading"
        : isSuperadmin
          ? "platform"
          : firmQuery.data
            ? "firm"
            : meQuery.data
              ? "client"
              : "guest";

  const login = useCallback(
    async (email: string, password: string) => {
      await loginWithPassword(email, password, "auto");
      setHasToken(true);
      await utils.auth.me.invalidate();
      await utils.firm.myFirm.invalidate();
    },
    [utils]
  );

  const logout = useCallback(async () => {
    try {
      await utils.client.auth.logout.mutate();
    } catch {
      // ignore
    }
    await logoutLocal();
    setHasToken(false);
    await utils.invalidate();
  }, [utils]);

  const value = useMemo<AuthContextValue>(() => {
    const caps = firmQuery.data?.capabilities;
    return {
      mode,
      user: meQuery.data
        ? {
            id: meQuery.data.id,
            email: meQuery.data.email,
            name: meQuery.data.name,
            role: meQuery.data.role,
            firmRole: firmQuery.data?.member?.firmRole ?? null,
            isClient: !isSuperadmin && !firmQuery.data && Boolean(meQuery.data),
          }
        : null,
      meName: meQuery.data?.name ?? null,
      firmName: firmQuery.data?.firm?.name ?? null,
      firmRole: firmQuery.data?.member?.firmRole ?? null,
      isSuperadmin,
      capabilities: caps
        ? {
            canCreateInvoice: Boolean(caps.canCreateInvoice),
            canInviteClients: Boolean(caps.canInviteClients),
            canSeeFirmWideCases: Boolean(caps.canSeeFirmWideCases),
          }
        : null,
      login,
      logout,
    };
  }, [firmQuery.data, isSuperadmin, login, logout, meQuery.data, mode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
