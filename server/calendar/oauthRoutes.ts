import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { calendarConnections } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb, getFirmMemberByUserId } from "../db";
import { sdk } from "../_core/sdk";
import { encryptSecret } from "./tokenCrypto";
import {
  exchangeGoogleCode,
  fetchGoogleAccountEmail,
  googleAuthorizeUrl,
  googleCalendarConfigured,
} from "./providers/google";
import {
  exchangeMicrosoftCode,
  fetchMicrosoftAccountEmail,
  microsoftAuthorizeUrl,
  microsoftCalendarConfigured,
} from "./providers/microsoft";

function appBase(req: Request) {
  return (ENV.appUrl || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function signState(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", ENV.cookieSecret || "cliavo")
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): { userId: number; provider: string; ts: number } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", ENV.cookieSecret || "cliavo")
    .update(body)
    .digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!data?.userId || Date.now() - data.ts > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

async function requireUser(req: Request) {
  return sdk.authenticateRequest(req);
}

export function registerCalendarOAuthRoutes(app: Express) {
  app.get("/api/oauth/calendar/:provider/start", async (req: Request, res: Response) => {
    try {
      const user = await requireUser(req);
      const provider = String(req.params.provider);
      const state = signState({ userId: user.id, provider, ts: Date.now() });
      const base = appBase(req);

      if (provider === "google") {
        if (!googleCalendarConfigured()) {
          return res.status(400).json({ error: "Google Calendar is not configured on this server." });
        }
        const redirectUri = `${base}/api/oauth/calendar/google/callback`;
        return res.redirect(googleAuthorizeUrl(state, redirectUri));
      }
      if (provider === "microsoft") {
        if (!microsoftCalendarConfigured()) {
          return res
            .status(400)
            .json({ error: "Microsoft / Outlook Calendar is not configured on this server." });
        }
        const redirectUri = `${base}/api/oauth/calendar/microsoft/callback`;
        return res.redirect(microsoftAuthorizeUrl(state, redirectUri));
      }
      return res.status(400).json({ error: "Unknown provider" });
    } catch {
      return res.status(401).json({ error: "Sign in required" });
    }
  });

  app.get("/api/oauth/calendar/google/callback", async (req: Request, res: Response) => {
    const base = appBase(req);
    try {
      const state = verifyState(String(req.query.state || ""));
      if (!state || state.provider !== "google") {
        return res.redirect(`${base}/settings?calendar=error&reason=state`);
      }
      const code = String(req.query.code || "");
      if (!code) return res.redirect(`${base}/settings?calendar=error&reason=code`);

      const redirectUri = `${base}/api/oauth/calendar/google/callback`;
      const tokens = await exchangeGoogleCode(code, redirectUri);
      const email = await fetchGoogleAccountEmail(tokens.access_token);
      const member = await getFirmMemberByUserId(state.userId);
      const db = await getDb();
      if (!db) return res.redirect(`${base}/settings?calendar=error&reason=db`);

      const [existing] = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.userId, state.userId),
            eq(calendarConnections.provider, "google")
          )
        )
        .limit(1);

      const values = {
        userId: state.userId,
        firmId: member?.firmId ?? null,
        provider: "google" as const,
        accountEmail: email,
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : existing?.refreshTokenEnc || null,
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        externalCalendarId: "primary",
        externalCalendarName: "Primary",
        syncEnabled: true,
        syncDirection: "both" as const,
        lastError: null,
      };

      if (existing) {
        await db.update(calendarConnections).set(values).where(eq(calendarConnections.id, existing.id));
      } else {
        await db.insert(calendarConnections).values(values);
      }
      return res.redirect(`${base}/settings?calendar=connected&provider=google`);
    } catch (err: any) {
      console.error("[Calendar] Google OAuth", err);
      return res.redirect(
        `${base}/settings?calendar=error&reason=${encodeURIComponent(err?.message || "oauth")}`
      );
    }
  });

  app.get("/api/oauth/calendar/microsoft/callback", async (req: Request, res: Response) => {
    const base = appBase(req);
    try {
      const state = verifyState(String(req.query.state || ""));
      if (!state || state.provider !== "microsoft") {
        return res.redirect(`${base}/settings?calendar=error&reason=state`);
      }
      const code = String(req.query.code || "");
      if (!code) return res.redirect(`${base}/settings?calendar=error&reason=code`);

      const redirectUri = `${base}/api/oauth/calendar/microsoft/callback`;
      const tokens = await exchangeMicrosoftCode(code, redirectUri);
      const email = await fetchMicrosoftAccountEmail(tokens.access_token);
      const member = await getFirmMemberByUserId(state.userId);
      const db = await getDb();
      if (!db) return res.redirect(`${base}/settings?calendar=error&reason=db`);

      const [existing] = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.userId, state.userId),
            eq(calendarConnections.provider, "microsoft")
          )
        )
        .limit(1);

      const values = {
        userId: state.userId,
        firmId: member?.firmId ?? null,
        provider: "microsoft" as const,
        accountEmail: email,
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : existing?.refreshTokenEnc || null,
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        externalCalendarId: null,
        externalCalendarName: "Default",
        syncEnabled: true,
        syncDirection: "both" as const,
        lastError: null,
      };

      if (existing) {
        await db.update(calendarConnections).set(values).where(eq(calendarConnections.id, existing.id));
      } else {
        await db.insert(calendarConnections).values(values);
      }
      return res.redirect(`${base}/settings?calendar=connected&provider=microsoft`);
    } catch (err: any) {
      console.error("[Calendar] Microsoft OAuth", err);
      return res.redirect(
        `${base}/settings?calendar=error&reason=${encodeURIComponent(err?.message || "oauth")}`
      );
    }
  });
}
