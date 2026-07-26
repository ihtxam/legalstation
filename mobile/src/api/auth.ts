import { LOGIN_URL } from "../config";
import { clearSessionToken, saveSessionToken } from "../auth/session";

export type LoginUser = {
  id: number;
  email: string | null;
  name: string | null;
  role: string;
  firmRole: string | null;
  isClient: boolean;
};

export type LoginResult = {
  ok: true;
  sessionToken: string;
  redirectTo: string;
  mustChangePassword?: boolean;
  user: LoginUser;
};

type Portal = "app" | "platform";

async function postLogin(email: string, password: string, portal: Portal) {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim(), password, portal }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function isSuperadminPortalHint(message: string) {
  const m = message.toLowerCase();
  return m.includes("superadmin") || m.includes("/platform/login") || m.includes("platform login");
}

/**
 * Firm/client use portal=app. Superadmins are rejected on app and must use portal=platform.
 * We try app first, then automatically retry as platform when the API says so.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  portal: Portal | "auto" = "auto"
): Promise<LoginResult> {
  if (portal === "platform") {
    return finishLogin(await postLogin(email, password, "platform"));
  }
  if (portal === "app") {
    return finishLogin(await postLogin(email, password, "app"));
  }

  const first = await postLogin(email, password, "app");
  if (first.res.ok) return finishLogin(first);

  const err = String(first.data?.error || "");
  if (first.res.status === 403 && isSuperadminPortalHint(err)) {
    return finishLogin(await postLogin(email, password, "platform"));
  }
  throw new Error(err || "Login failed");
}

async function finishLogin(result: { res: Response; data: any }): Promise<LoginResult> {
  if (!result.res.ok) {
    throw new Error(result.data?.error || "Login failed");
  }
  if (!result.data.sessionToken) {
    throw new Error("Server did not return a session token. Update the API and try again.");
  }
  await saveSessionToken(result.data.sessionToken);
  return result.data as LoginResult;
}

export async function logoutLocal() {
  await clearSessionToken();
}
