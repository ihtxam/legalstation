import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import { randomId } from "@/lib/randomId";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** True when Manus OAuth portal env vars are present (optional for SaaS). */
export function isOAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
}

/** Allow only same-origin relative paths (e.g. /invite/abc). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("://")) return null;
  return next;
}

/**
 * Navigate to the SaaS login page (email/password).
 * Use `portal: "platform"` for LexFlow superadmin login only.
 * Pass `next` to return the user to a page after login (e.g. invite link).
 */
export const startLogin = (opts?: { portal?: "app" | "platform"; next?: string }) => {
  const portal = opts?.portal ?? "app";
  const loginPath = portal === "platform" ? "/platform/login" : "/login";
  const next = safeNextPath(opts?.next);
  const href = next ? `${loginPath}?next=${encodeURIComponent(next)}` : loginPath;
  if (window.location.pathname + window.location.search !== href) {
    window.location.href = href;
  }
};

/** Optional Manus OAuth sign-in (legacy / enterprise). */
export const startOAuthLogin = () => {
  if (!isOAuthConfigured()) {
    startLogin();
    return;
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = randomId();
  const secure = window.location.protocol === "https:";
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=${secure ? "None" : "Lax"}${secure ? "; Secure" : ""}`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};
