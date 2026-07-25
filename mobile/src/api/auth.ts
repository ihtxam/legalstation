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

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim(), password, portal: "app" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Login failed");
  }
  if (!data.sessionToken) {
    throw new Error("Server did not return a session token. Update the API and try again.");
  }
  await saveSessionToken(data.sessionToken);
  return data as LoginResult;
}

export async function logoutLocal() {
  await clearSessionToken();
}
