/**
 * Smoke E2E against a real DB when available.
 * Skips cleanly when DATABASE_URL is missing or unreachable.
 *
 * Run: DEMO_AUTH_ENABLED=true pnpm test:smoke
 */
import "dotenv/config";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { seedDemoData } from "./demo/seedDemo";

async function dbReady(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    // Lightweight connectivity check via seed path tables
    const { users } = await import("../drizzle/schema");
    await db.select({ id: users.id }).from(users).limit(1);
    return true;
  } catch {
    return false;
  }
}

function makeCaller(user: {
  id: number;
  openId: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin" | "superadmin";
}) {
  const ctx: TrpcContext = {
    user: {
      id: user.id,
      openId: user.openId,
      email: user.email,
      name: user.name,
      loginMethod: "demo",
      role: user.role,
      totpSecret: null,
      totpEnabled: false,
      preferredLocale: "en",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "http", headers: { origin: "http://localhost:3000" } } as TrpcContext["req"],
    res: { clearCookie: () => undefined, cookie: () => undefined } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("smoke e2e (seeded demo users)", () => {
  it("seeds demo tenant and loads cases/clients for admin", async () => {
    if (!(await dbReady())) {
      console.warn("[smoke] skipping — database not available");
      return;
    }

    const seeded = await seedDemoData();
    expect(seeded.firmId).toBeGreaterThan(0);
    expect(seeded.caseId).toBeGreaterThan(0);
    expect(seeded.users.length).toBe(3);

    const admin = seeded.users.find((u) => u.openId === "demo-admin")!;
    const caller = makeCaller({
      id: admin.id,
      openId: admin.openId,
      email: admin.email,
      name: admin.name,
      role: "admin",
    });

    const me = await caller.auth.me();
    expect(me?.email).toBe("admin@demo.cliavo.ch");

    const firm = await caller.firm.myFirm();
    expect(firm?.firm.slug).toBe("demo-cabinet");

    const cases = await caller.cases.list({});
    expect(cases.some((c) => c.referenceNumber === "DEMO-2026-001")).toBe(true);

    const clients = await caller.clients.list({});
    expect(clients.some((c) => c.email === "client@demo.cliavo.ch")).toBe(true);

    const clientUser = seeded.users.find((u) => u.openId === "demo-client")!;
    const clientCaller = makeCaller({
      id: clientUser.id,
      openId: clientUser.openId,
      email: clientUser.email,
      name: clientUser.name,
      role: "user",
    });
    const clientCases = await clientCaller.cases.list({});
    expect(clientCases.length).toBeGreaterThan(0);
  }, 60_000);
});
