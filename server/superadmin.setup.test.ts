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
    loginMethod: "password",
    role,
    passwordHash: null,
    mustChangePassword: false,
    totpSecret: null,
    totpEnabled: false,
    preferredLocale: "en",
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
  it("requires a bootstrap secret (no click-to-elevate)", async () => {
    const ctx = createAuthContext(999, "user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.superadmin.setupSuperadmin({ bootstrapSecret: "wrong" })).rejects.toThrow();
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
    await expect(
      caller.superadmin.setupSuperadmin({ bootstrapSecret: "anything" })
    ).rejects.toThrow();
  });

  it("blocks non-superadmins from listFirms", async () => {
    const ctx = createAuthContext(1, "user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.superadmin.listFirms()).rejects.toThrow(/Superadmin/);
  });
});
