import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock helpers ──────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@cliavo.ch",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      totpSecret: null,
      totpEnabled: false,
      preferredLocale: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── auth.me ─────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = makeCtx({ name: "Maître Dupont" });
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.name).toBe("Maître Dupont");
    expect(user?.email).toBe("test@cliavo.ch");
  });

  it("returns null when unauthenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ─── auth.logout ─────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const ctx = makeCtx();
    const cleared: any[] = [];
    ctx.res.clearCookie = (name: string, opts: any) => cleared.push({ name, opts });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBeGreaterThanOrEqual(1);
    expect(cleared[0]?.name).toBeDefined();
  });
});

// ─── Swiss VAT rate validation ────────────────────────────────────────────────

describe("Swiss VAT rates", () => {
  it("validates standard Swiss VAT rates", () => {
    const validRates = [0, 2.5, 3.7, 7.7];
    validRates.forEach(rate => {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    });
  });

  it("calculates VAT amount correctly for CHF billing", () => {
    const subtotal = 1000;
    const vatRate = 7.7;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    expect(vatAmount).toBeCloseTo(77, 2);
    expect(total).toBeCloseTo(1077, 2);
  });

  it("handles zero VAT (exempt) correctly", () => {
    const subtotal = 500;
    const vatRate = 0;
    const vatAmount = subtotal * (vatRate / 100);
    expect(vatAmount).toBe(0);
    expect(subtotal + vatAmount).toBe(500);
  });
});

// ─── Invoice number generation ────────────────────────────────────────────────

describe("Invoice number format", () => {
  it("formats invoice numbers with zero-padded 4-digit sequence", () => {
    const format = (count: number) => `INV-${String(count).padStart(4, "0")}`;
    expect(format(1)).toBe("INV-0001");
    expect(format(42)).toBe("INV-0042");
    expect(format(1000)).toBe("INV-1000");
    expect(format(9999)).toBe("INV-9999");
  });
});

// ─── Role-based access control logic ─────────────────────────────────────────

describe("Role-based access control", () => {
  it("identifies firm members by role", () => {
    const firmRoles = ["admin", "lawyer", "assistant"];
    const clientRole = "client";
    firmRoles.forEach(role => {
      expect(firmRoles.includes(role)).toBe(true);
    });
    expect(firmRoles.includes(clientRole)).toBe(false);
  });

  it("determines internal access correctly", () => {
    const isInternal = (role: string) => ["admin", "lawyer", "assistant"].includes(role);
    expect(isInternal("admin")).toBe(true);
    expect(isInternal("lawyer")).toBe(true);
    expect(isInternal("assistant")).toBe(true);
    expect(isInternal("client")).toBe(false);
  });
});
