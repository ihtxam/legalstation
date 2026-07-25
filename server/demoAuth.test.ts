import { describe, expect, it } from "vitest";
import { isDemoAuthEnabled } from "./demo/demoAuth";
import { DEMO_USERS } from "./demo/seedDemo";

describe("demo auth guards", () => {
  it("lists three demo personas", () => {
    expect(DEMO_USERS).toHaveLength(3);
    expect(DEMO_USERS.map((u) => u.openId).sort()).toEqual([
      "demo-admin",
      "demo-client",
      "demo-lawyer",
    ]);
  });

  it("is disabled by default", () => {
    const prev = process.env.DEMO_AUTH_ENABLED;
    const prevProd = process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    const prevNode = process.env.NODE_ENV;
    delete process.env.DEMO_AUTH_ENABLED;
    delete process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    process.env.NODE_ENV = "development";
    expect(isDemoAuthEnabled()).toBe(false);
    process.env.DEMO_AUTH_ENABLED = prev;
    process.env.DEMO_AUTH_ALLOW_PRODUCTION = prevProd;
    process.env.NODE_ENV = prevNode;
  });

  it("can be enabled in development", () => {
    const prev = process.env.DEMO_AUTH_ENABLED;
    const prevProd = process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    const prevNode = process.env.NODE_ENV;
    process.env.DEMO_AUTH_ENABLED = "true";
    delete process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    process.env.NODE_ENV = "development";
    expect(isDemoAuthEnabled()).toBe(true);
    process.env.DEMO_AUTH_ENABLED = prev;
    process.env.DEMO_AUTH_ALLOW_PRODUCTION = prevProd;
    process.env.NODE_ENV = prevNode;
  });

  it("stays off in production without explicit allow", () => {
    const prev = process.env.DEMO_AUTH_ENABLED;
    const prevProd = process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    const prevNode = process.env.NODE_ENV;
    process.env.DEMO_AUTH_ENABLED = "true";
    delete process.env.DEMO_AUTH_ALLOW_PRODUCTION;
    process.env.NODE_ENV = "production";
    expect(isDemoAuthEnabled()).toBe(false);
    process.env.DEMO_AUTH_ENABLED = prev;
    process.env.DEMO_AUTH_ALLOW_PRODUCTION = prevProd;
    process.env.NODE_ENV = prevNode;
  });
});
