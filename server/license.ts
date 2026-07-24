import { createHmac, timingSafeEqual } from "crypto";
import { isOnPremise } from "./deployment";

export type LicensePayload = {
  customerId: string;
  maxUsers: number;
  expiresAt: string;
  edition?: "starter" | "pro" | "enterprise";
};

export type LicenseStatus = {
  valid: boolean;
  reason?: string;
  inGracePeriod: boolean;
  graceDaysRemaining: number;
  payload: LicensePayload | null;
  checkedAt: string;
};

const GRACE_DAYS_DEFAULT = 14;

function runtimeLicenseConfig() {
  return {
    key: process.env.LICENSE_KEY ?? "",
    secret: process.env.LICENSE_SIGNING_SECRET ?? "",
    graceDays: Number(process.env.LICENSE_GRACE_DAYS || GRACE_DAYS_DEFAULT),
  };
}

function signPayload(payloadJson: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadJson).digest("base64url");
}

/** Encode a license for offline distribution: base64url(json).signature */
export function issueLicense(payload: LicensePayload, secret?: string): string {
  const signingSecret = secret || runtimeLicenseConfig().secret;
  if (!signingSecret) throw new Error("LICENSE_SIGNING_SECRET is required to issue licenses");
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  return `${body}.${signPayload(json, signingSecret)}`;
}

export function parseAndVerifyLicense(
  licenseKey: string,
  secret?: string
): { ok: true; payload: LicensePayload } | { ok: false; reason: string } {
  const signingSecret = secret || runtimeLicenseConfig().secret;
  if (!signingSecret) return { ok: false, reason: "LICENSE_SIGNING_SECRET not configured" };
  const [body, sig] = licenseKey.split(".");
  if (!body || !sig) return { ok: false, reason: "Malformed license key" };

  let json: string;
  try {
    json = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "Invalid license encoding" };
  }

  const expected = signPayload(json, signingSecret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid license signature" };
  }

  try {
    const payload = JSON.parse(json) as LicensePayload;
    if (!payload.customerId || !payload.expiresAt || !payload.maxUsers) {
      return { ok: false, reason: "Incomplete license payload" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "Invalid license JSON" };
  }
}

export function evaluateLicense(
  now: Date = new Date(),
  graceDays?: number
): LicenseStatus {
  const checkedAt = now.toISOString();
  const cfg = runtimeLicenseConfig();
  const grace = graceDays ?? cfg.graceDays;

  if (!isOnPremise()) {
    return {
      valid: true,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      payload: null,
      checkedAt,
      reason: "saas_mode",
    };
  }

  if (!cfg.key) {
    return {
      valid: false,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      payload: null,
      checkedAt,
      reason: "LICENSE_KEY missing",
    };
  }

  const parsed = parseAndVerifyLicense(cfg.key, cfg.secret);
  if (!parsed.ok) {
    return {
      valid: false,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      payload: null,
      checkedAt,
      reason: parsed.reason,
    };
  }

  const expiresAt = new Date(parsed.payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      valid: false,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      payload: parsed.payload,
      checkedAt,
      reason: "Invalid expiresAt",
    };
  }

  if (now.getTime() <= expiresAt.getTime()) {
    return {
      valid: true,
      inGracePeriod: false,
      graceDaysRemaining: 0,
      payload: parsed.payload,
      checkedAt,
    };
  }

  const graceEnd = expiresAt.getTime() + grace * 24 * 60 * 60 * 1000;
  if (now.getTime() <= graceEnd) {
    const remaining = Math.ceil((graceEnd - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      valid: true,
      inGracePeriod: true,
      graceDaysRemaining: remaining,
      payload: parsed.payload,
      checkedAt,
      reason: "grace_period",
    };
  }

  return {
    valid: false,
    inGracePeriod: false,
    graceDaysRemaining: 0,
    payload: parsed.payload,
    checkedAt,
    reason: "license_expired",
  };
}

export function wrapTenantDek(dek: Buffer, kek: Buffer): string {
  const mac = createHmac("sha256", kek).update(dek).digest();
  return Buffer.concat([dek, mac.subarray(0, 16)]).toString("base64");
}

export function unwrapTenantDek(wrapped: string, kek: Buffer): Buffer | null {
  const buf = Buffer.from(wrapped, "base64");
  if (buf.length < 17) return null;
  const dek = buf.subarray(0, buf.length - 16);
  const mac = buf.subarray(buf.length - 16);
  const expected = createHmac("sha256", kek).update(dek).digest().subarray(0, 16);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  return dek;
}
