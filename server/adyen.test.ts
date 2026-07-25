import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifyAdyenWebhookSignature } from "./adyen";

describe("Adyen webhook HMAC", () => {
  it("rejects missing key or signature", () => {
    expect(verifyAdyenWebhookSignature("{}", "sig", "")).toBe(false);
    expect(verifyAdyenWebhookSignature("{}", "", "abcd")).toBe(false);
  });

  it("accepts a matching HMAC-SHA256 (base64) signature", () => {
    const body = JSON.stringify({ type: "payment", originalReference: "INV-1" });
    const hmacKey = Buffer.alloc(32, 7).toString("hex");
    const key = Buffer.from(hmacKey, "hex");
    const signature = crypto.createHmac("sha256", key).update(body, "utf8").digest("base64");
    expect(verifyAdyenWebhookSignature(body, signature, hmacKey)).toBe(true);
    expect(verifyAdyenWebhookSignature(body, "invalid", hmacKey)).toBe(false);
  });
});
