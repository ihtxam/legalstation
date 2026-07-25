import type { Request, Response } from "express";
import { COOKIE_NAME, IMPERSONATOR_COOKIE, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import type { User } from "../drizzle/schema";

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie || "";
  const match = raw
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getSessionCookieToken(req: Request): string | null {
  return readCookie(req, COOKIE_NAME);
}

export function getImpersonatorSessionToken(req: Request): string | null {
  return readCookie(req, IMPERSONATOR_COOKIE);
}

export async function startImpersonationSession(
  req: Request,
  res: Response,
  opts: { targetUser: User; currentSessionToken: string | null }
) {
  const cookieOptions = getSessionCookieOptions(req);

  // Preserve the superadmin session so they can return
  if (opts.currentSessionToken) {
    res.cookie(IMPERSONATOR_COOKIE, opts.currentSessionToken, {
      ...cookieOptions,
      maxAge: ONE_YEAR_MS,
    });
  }

  const sessionToken = await sdk.createSessionToken(opts.targetUser.openId, {
    name: opts.targetUser.name || opts.targetUser.email || opts.targetUser.openId,
    expiresInMs: ONE_YEAR_MS,
  });
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

export async function stopImpersonationSession(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  const original = getImpersonatorSessionToken(req);
  if (!original) {
    return { restored: false as const };
  }

  const verified = await sdk.verifySession(original);
  if (!verified) {
    res.clearCookie(IMPERSONATOR_COOKIE, { ...cookieOptions, maxAge: -1 });
    return { restored: false as const };
  }

  res.cookie(COOKIE_NAME, original, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  res.clearCookie(IMPERSONATOR_COOKIE, { ...cookieOptions, maxAge: -1 });
  return { restored: true as const, openId: verified.openId };
}
