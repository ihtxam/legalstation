import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { users, firmMembers, clients } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { hashPassword, verifyPassword } from "./password";
import { resolveFirmFromHost } from "../tenant";

async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

async function issueSession(req: Request, res: Response, user: typeof users.$inferSelect) {
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || user.email || user.openId,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  const db = await getDb();
  let firmRole: string | null = null;
  let isClient = false;
  if (db) {
    const [member] = await db
      .select()
      .from(firmMembers)
      .where(eq(firmMembers.userId, user.id))
      .limit(1);
    firmRole = member?.firmRole ?? null;
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);
    isClient = Boolean(client);
  }

  let redirectTo = "/dashboard";
  if (user.role === "superadmin") redirectTo = "/superadmin";
  else if (isClient && !firmRole) redirectTo = "/client-portal";
  else if (firmRole) redirectTo = "/dashboard";

  return {
    ok: true as const,
    /** JWT for native / Bearer clients (also set as httpOnly cookie for web). */
    sessionToken,
    redirectTo,
    mustChangePassword: Boolean(user.mustChangePassword),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      firmRole,
      isClient,
    },
  };
}

export function registerPasswordAuthRoutes(app: Express) {
  app.get("/api/auth/tenant", async (req: Request, res: Response) => {
    try {
      const firm = await resolveFirmFromHost(req);
      if (!firm) {
        return res.json({
          mode: "platform",
          appName: "LexFlow",
          loginHint: null,
        });
      }
      return res.json({
        mode: "firm",
        firmId: firm.id,
        name: firm.name,
        slug: firm.slug,
        logoUrl: firm.logoUrl,
        primaryColor: firm.primaryColor,
        secondaryColor: firm.secondaryColor,
        onboardingCompleted: Boolean(firm.onboardingCompletedAt),
      });
    } catch (err: any) {
      console.error("[Auth] tenant resolve failed", err?.message || err);
      return res.json({
        mode: "platform",
        appName: "LexFlow",
        loginHint: null,
      });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const portal = typeof req.body?.portal === "string" ? req.body.portal : "app";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const user = await findUserByEmail(email);
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Platform portal: only superadmins
      if (portal === "platform") {
        if (user.role !== "superadmin") {
          return res.status(403).json({
            error: "Platform login is for LexFlow superadmins only. Use your firm login URL.",
          });
        }
      } else {
        // App / firm portal: never allow superadmin into firm UI via this path
        if (user.role === "superadmin") {
          return res.status(403).json({
            error: "Superadmins must sign in at /platform/login",
          });
        }
      }

      const db = await getDb();
      if (db) {
        await db
          .update(users)
          .set({ lastSignedIn: new Date(), loginMethod: "password" })
          .where(eq(users.id, user.id));
      }

      const payload = await issueSession(req, res, { ...user, loginMethod: "password" });
      if (portal === "platform") {
        payload.redirectTo = "/superadmin";
      }
      return res.json(payload);
    } catch (err: any) {
      console.error("[Auth] login failed", err);
      return res.status(500).json({ error: err.message ?? "Login failed" });
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });
      const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!row) return res.status(404).json({ error: "User not found" });

      if (row.passwordHash) {
        if (!verifyPassword(currentPassword, row.passwordHash)) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      await db
        .update(users)
        .set({
          passwordHash: hashPassword(newPassword),
          mustChangePassword: false,
          loginMethod: "password",
        })
        .where(eq(users.id, user.id));

      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[Auth] change-password failed", err);
      return res.status(500).json({ error: err.message ?? "Failed" });
    }
  });

  /** One-time bootstrap: create first platform superadmin with email/password. */
  app.post("/api/auth/bootstrap-superadmin", async (req: Request, res: Response) => {
    const secret = typeof req.body?.bootstrapSecret === "string" ? req.body.bootstrapSecret : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "Platform Admin";

    if (!ENV.superadminBootstrapSecret) {
      return res.status(404).json({ error: "Bootstrap disabled" });
    }
    if (!secret || secret !== ENV.superadminBootstrapSecret) {
      return res.status(403).json({ error: "Invalid bootstrap secret" });
    }
    if (!email || password.length < 8) {
      return res.status(400).json({ error: "Valid email and password (8+) required" });
    }

    try {
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      const existing = await db.select().from(users).where(eq(users.role, "superadmin")).limit(1);
      if (existing[0]) {
        return res.status(409).json({ error: "A superadmin already exists" });
      }

      const openId = `password-superadmin-${email}`;
      await db.insert(users).values({
        openId,
        email,
        name,
        role: "superadmin",
        loginMethod: "password",
        passwordHash: hashPassword(password),
        mustChangePassword: false,
      });

      const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) return res.status(500).json({ error: "Failed to create user" });

      const payload = await issueSession(req, res, user);
      payload.redirectTo = "/superadmin";
      return res.json(payload);
    } catch (err: any) {
      console.error("[Auth] bootstrap failed", err);
      return res.status(500).json({ error: err.message ?? "Bootstrap failed" });
    }
  });
}
