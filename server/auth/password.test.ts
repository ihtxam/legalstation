import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, slugifyFirmName, verifyPassword } from "./password";

describe("password helpers", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("CorrectHorseBattery!");
    expect(hash).toContain(":");
    expect(verifyPassword("CorrectHorseBattery!", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("generates temporary passwords of expected length", () => {
    const pwd = generateTemporaryPassword(16);
    expect(pwd).toHaveLength(16);
  });

  it("slugifies firm names", () => {
    expect(slugifyFirmName("Müller & Partner AG")).toBe("muller-partner-ag");
    expect(slugifyFirmName("Isha & co")).toBe("isha-co");
    expect(slugifyFirmName("isha-&-co")).toBe("isha-co");
  });
});
