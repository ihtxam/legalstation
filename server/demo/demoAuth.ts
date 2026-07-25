import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { DEMO_USERS, seedDemoData } from "./seedDemo";

function boolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

/** Demo login is off in production unless explicitly allowed. */
export function isDemoAuthEnabled(): boolean {
  if (!boolEnv(process.env.DEMO_AUTH_ENABLED)) return false;
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !boolEnv(process.env.DEMO_AUTH_ALLOW_PRODUCTION)) {
    return false;
  }
  return true;
}

export function registerDemoAuthRoutes(app: Express) {
  app.get("/api/demo/status", (_req: Request, res: Response) => {
    res.json({
      enabled: isDemoAuthEnabled(),
      users: isDemoAuthEnabled()
        ? DEMO_USERS.map((u) => ({ email: u.email, name: u.name, openId: u.openId }))
        : [],
    });
  });

  app.post("/api/demo/seed", async (_req: Request, res: Response) => {
    if (!isDemoAuthEnabled()) {
      return res.status(404).json({ error: "Demo auth disabled" });
    }
    try {
      const result = await seedDemoData();
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[Demo] seed failed", err);
      return res.status(500).json({ error: err.message ?? "Seed failed" });
    }
  });

  app.post("/api/demo/login", async (req: Request, res: Response) => {
    if (!isDemoAuthEnabled()) {
      return res.status(404).json({ error: "Demo auth disabled" });
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const openId = typeof req.body?.openId === "string" ? req.body.openId.trim() : "";
    if (!email && !openId) {
      return res.status(400).json({ error: "email or openId required" });
    }

    try {
      // Ensure demo tenant exists before login
      await seedDemoData();

      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database not available" });

      const allowed = new Set<string>(DEMO_USERS.map((u) => u.email.toLowerCase()));
      const allowedOpenIds = new Set<string>(DEMO_USERS.map((u) => u.openId));

      let [user] = openId
        ? await db.select().from(users).where(eq(users.openId, openId)).limit(1)
        : await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        return res.status(404).json({ error: "Demo user not found" });
      }
      if (
        !allowedOpenIds.has(String(user.openId)) &&
        !(user.email && allowed.has(user.email.toLowerCase()))
      ) {
        return res.status(403).json({ error: "Not a demo user" });
      }

      await db
        .update(users)
        .set({ lastSignedIn: new Date(), loginMethod: "demo" })
        .where(eq(users.id, user.id));

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const base = getSessionCookieOptions(req);
      // Browsers reject SameSite=None without Secure; use Lax on plain HTTP.
      const cookieOptions = {
        ...base,
        sameSite: base.secure ? ("none" as const) : ("lax" as const),
        secure: Boolean(base.secure),
      };

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          openId: user.openId,
          role: user.role,
        },
      });
    } catch (err: any) {
      console.error("[Demo] login failed", err);
      return res.status(500).json({ error: err.message ?? "Demo login failed" });
    }
  });
}
