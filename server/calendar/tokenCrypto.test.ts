import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./tokenCrypto";

describe("calendar token crypto", () => {
  it("round-trips secrets", () => {
    const plain = "refresh-token-abc-123";
    const enc = encryptSecret(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });
});
