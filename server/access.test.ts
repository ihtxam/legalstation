import { describe, expect, it } from "vitest";
import { DEMO_USERS } from "./demo/seedDemo";

describe("access model expectations", () => {
  it("demo personas cover admin, lawyer, and client", () => {
    const roles = DEMO_USERS.map((u) => u.openId);
    expect(roles).toContain("demo-admin");
    expect(roles).toContain("demo-lawyer");
    expect(roles).toContain("demo-client");
  });
});
