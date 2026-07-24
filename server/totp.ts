import * as OTPAuth from "otpauth";
import { createHmac, timingSafeEqual } from "crypto";
import { ENV } from "./_core/env";

const ISSUER = "LexFlow";

export function generateTotpSecret(accountName: string): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return {
    secret: secret.base32,
    otpauthUrl: totp.toString(),
  };
}

export function verifyTotpCode(secretBase32: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: token.replace(/\s/g, ""), window: 1 });
  return delta !== null;
}

/** Short-lived signed cookie proving 2FA passed for this user. */
export function signTwoFactorOk(userId: number, expiresAtMs: number): string {
  const payload = `${userId}.${expiresAtMs}`;
  const sig = createHmac("sha256", ENV.cookieSecret || "dev")
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyTwoFactorOk(
  value: string | undefined,
  userId: number,
  now = Date.now()
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [uid, exp, sig] = parts;
  if (Number(uid) !== userId) return false;
  if (Number(exp) < now) return false;
  const payload = `${uid}.${exp}`;
  const expected = createHmac("sha256", ENV.cookieSecret || "dev")
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const TWO_FACTOR_COOKIE = "lexflow_2fa_ok";
export const TWO_FACTOR_TTL_MS = 12 * 60 * 60 * 1000;
