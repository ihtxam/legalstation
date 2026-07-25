import { describe, expect, it } from "vitest";
import { IMPERSONATOR_COOKIE, COOKIE_NAME } from "../shared/const";

describe("impersonation cookies", () => {
  it("uses distinct cookie names for session and impersonator", () => {
    expect(COOKIE_NAME).toBe("app_session_id");
    expect(IMPERSONATOR_COOKIE).toBe("lexflow_impersonator");
    expect(IMPERSONATOR_COOKIE).not.toBe(COOKIE_NAME);
  });
});
