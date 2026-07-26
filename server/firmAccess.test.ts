import { describe, expect, it } from "vitest";
import { LOCKED_FIRM_ALLOWED_PATHS } from "./firmAccess";

describe("firmAccess allowlist", () => {
  it("allows account and support while locked", () => {
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("firm.account")).toBe(true);
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("firm.createPlanCheckout")).toBe(true);
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("supportTickets.create")).toBe(true);
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("firm.myFirm")).toBe(true);
  });

  it("does not allow ordinary workspace paths", () => {
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("cases.list")).toBe(false);
    expect(LOCKED_FIRM_ALLOWED_PATHS.has("clients.list")).toBe(false);
  });
});
