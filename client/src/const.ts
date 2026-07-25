import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import { randomId } from "@/lib/randomId";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

function oauthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
}

/**
 * Navigate to the SaaS login page (email/password).
 * Use `portal: "platform"` for LexFlow superadmin login only.
 */
export const startLogin = (opts?: { portal?: "app" | "platform" }) => {
  const portal = opts?.portal ?? "app";
  const loginPath = portal === "platform" ? "/platform/login" : "/login";
  if (window.location.pathname !== loginPath) {
    window.location.href = loginPath;
  }
};

/** Optional Manus OAuth sign-in (legacy / enterprise). */
export const startOAuthLogin = () => {
  if (!oauthConfigured()) {
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
