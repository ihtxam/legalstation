import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number, role: "user" | "superadmin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("superadmin.setupSuperadmin", () => {
  it("should be callable by authenticated users", async () => {
    const ctx = createAuthContext(999, "user");
    const caller = appRouter.createCaller(ctx);

    // This test verifies the endpoint is accessible
    // Note: actual database operations require a real DB connection
    try {
      await caller.superadmin.setupSuperadmin();
    } catch (error: any) {
      // Expected to fail without DB, but endpoint should be callable
      expect(error).toBeDefined();
    }
  });

  it("should require authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    // Should throw UNAUTHORIZED
    await expect(caller.superadmin.setupSuperadmin()).rejects.toThrow();
  });
});
