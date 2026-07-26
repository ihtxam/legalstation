import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import {
  generateTotpSecret,
  signTwoFactorOk,
  verifyTotpCode,
  verifyTwoFactorOk,
} from "./totp";

describe("totp helpers", () => {
  it("generates a verifiable TOTP secret", () => {
    const { secret } = generateTotpSecret("alice@example.com");
    const totp = new OTPAuth.TOTP({
      issuer: "Cliavo",
      label: "alice@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyTotpCode(secret, token)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("signs and verifies 2FA session cookies", () => {
    const exp = Date.now() + 60_000;
    const cookie = signTwoFactorOk(42, exp);
    expect(verifyTwoFactorOk(cookie, 42)).toBe(true);
    expect(verifyTwoFactorOk(cookie, 99)).toBe(false);
    expect(verifyTwoFactorOk(signTwoFactorOk(42, Date.now() - 1000), 42)).toBe(false);
  });
});
