import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  evaluateLicense,
  issueLicense,
  parseAndVerifyLicense,
  unwrapTenantDek,
  wrapTenantDek,
} from "./license";

const SECRET = "test-license-secret-please-change";

describe("on-prem license module", () => {
  const prevMode = process.env.DEPLOYMENT_MODE;
  const prevKey = process.env.LICENSE_KEY;
  const prevSecret = process.env.LICENSE_SIGNING_SECRET;
  const prevGrace = process.env.LICENSE_GRACE_DAYS;

  beforeEach(() => {
    process.env.LICENSE_SIGNING_SECRET = SECRET;
    process.env.DEPLOYMENT_MODE = "on_premise";
    delete process.env.LICENSE_KEY;
    process.env.LICENSE_GRACE_DAYS = "14";
  });

  afterEach(() => {
    if (prevMode === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = prevMode;
    if (prevKey === undefined) delete process.env.LICENSE_KEY;
    else process.env.LICENSE_KEY = prevKey;
    if (prevSecret === undefined) delete process.env.LICENSE_SIGNING_SECRET;
    else process.env.LICENSE_SIGNING_SECRET = prevSecret;
    if (prevGrace === undefined) delete process.env.LICENSE_GRACE_DAYS;
    else process.env.LICENSE_GRACE_DAYS = prevGrace;
  });

  it("issues and verifies a signed license offline", () => {
    const key = issueLicense({
      customerId: "firm-acme",
      maxUsers: 25,
      expiresAt: "2030-01-01T00:00:00.000Z",
      edition: "pro",
    });
    const parsed = parseAndVerifyLicense(key);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.customerId).toBe("firm-acme");
      expect(parsed.payload.maxUsers).toBe(25);
    }
  });

  it("rejects tampered licenses", () => {
    const key = issueLicense({
      customerId: "firm-acme",
      maxUsers: 25,
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    const [body] = key.split(".");
    const parsed = parseAndVerifyLicense(`${body}.AAAA`);
    expect(parsed.ok).toBe(false);
  });

  it("is valid before expiry and enters grace after expiry", () => {
    process.env.LICENSE_KEY = issueLicense({
      customerId: "firm-acme",
      maxUsers: 10,
      expiresAt: "2026-07-01T00:00:00.000Z",
    });

    const active = evaluateLicense(new Date("2026-06-01T00:00:00.000Z"));
    expect(active.valid).toBe(true);
    expect(active.inGracePeriod).toBe(false);

    const grace = evaluateLicense(new Date("2026-07-10T00:00:00.000Z"), 14);
    expect(grace.valid).toBe(true);
    expect(grace.inGracePeriod).toBe(true);
    expect(grace.graceDaysRemaining).toBeGreaterThan(0);

    const expired = evaluateLicense(new Date("2026-08-20T00:00:00.000Z"), 14);
    expect(expired.valid).toBe(false);
    expect(expired.reason).toBe("license_expired");
  });

  it("treats saas mode as always licensed", () => {
    process.env.DEPLOYMENT_MODE = "saas";
    const status = evaluateLicense();
    expect(status.valid).toBe(true);
    expect(status.reason).toBe("saas_mode");
  });

  it("wraps and unwraps tenant DEKs with KEK", () => {
    const dek = Buffer.from("0123456789abcdef0123456789abcdef");
    const kek = Buffer.from("kek-secret-key-material-32bytes!!");
    const wrapped = wrapTenantDek(dek, kek);
    expect(unwrapTenantDek(wrapped, kek)?.equals(dek)).toBe(true);
    expect(unwrapTenantDek(wrapped, Buffer.from("wrong-kek-material-xxxxxxxxxxxx"))).toBeNull();
  });
});
