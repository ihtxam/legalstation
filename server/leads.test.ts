import { describe, expect, it } from "vitest";
import { z } from "zod";

const leadInput = z.object({
  type: z.enum(["demo", "signup"]),
  firmName: z.string().min(2).max(255),
  contactName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
});

describe("platform lead input", () => {
  it("accepts demo and signup payloads", () => {
    for (const type of ["demo", "signup"] as const) {
      const parsed = leadInput.parse({
        type,
        firmName: "Müller & Partner AG",
        contactName: "Anna Müller",
        email: "anna@example.ch",
        phone: "+41 44 123 45 67",
        message: "Interested in LexFlow",
      });
      expect(parsed.type).toBe(type);
      expect(parsed.email).toBe("anna@example.ch");
    }
  });

  it("rejects invalid email", () => {
    expect(() =>
      leadInput.parse({
        type: "demo",
        firmName: "Test Firm",
        contactName: "Test",
        email: "not-an-email",
      })
    ).toThrow();
  });
});
