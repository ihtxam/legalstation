import { eq } from "drizzle-orm";
import {
  caseAssignments,
  cases,
  clients,
  firmMembers,
  firms,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";

export const DEMO_USERS = [
  {
    openId: "demo-admin",
    email: "admin@demo.lexflow.ch",
    name: "Demo Admin",
    role: "admin" as const,
    firmRole: "admin" as const,
  },
  {
    openId: "demo-lawyer",
    email: "lawyer@demo.lexflow.ch",
    name: "Demo Lawyer",
    role: "user" as const,
    firmRole: "lawyer" as const,
  },
  {
    openId: "demo-client",
    email: "client@demo.lexflow.ch",
    name: "Demo Client",
    role: "user" as const,
    firmRole: null,
  },
] as const;

export type SeedDemoResult = {
  firmId: number;
  caseId: number;
  clientId: number;
  users: Array<{ id: number; email: string; name: string; openId: string }>;
};

/** Idempotent demo tenant: firm + admin/lawyer/client + one open case. */
export async function seedDemoData(): Promise<SeedDemoResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const slug = "demo-cabinet";
  let [firm] = await db.select().from(firms).where(eq(firms.slug, slug)).limit(1);
  if (!firm) {
    await db.insert(firms).values({
      name: "Cabinet Demo SA",
      slug,
      email: "hello@demo.lexflow.ch",
      address: "Rue du Rhône 1, 1204 Genève",
      phone: "+41 22 000 00 00",
      vatNumber: "CHE-000.000.000 MWST",
    });
    [firm] = await db.select().from(firms).where(eq(firms.slug, slug)).limit(1);
  }
  if (!firm) throw new Error("Failed to create demo firm");

  const seededUsers: SeedDemoResult["users"] = [];

  for (const demo of DEMO_USERS) {
    let [user] = await db.select().from(users).where(eq(users.openId, demo.openId)).limit(1);
    if (!user) {
      await db.insert(users).values({
        openId: demo.openId,
        email: demo.email,
        name: demo.name,
        loginMethod: "demo",
        role: demo.role,
        preferredLocale: "en",
        lastSignedIn: new Date(),
      });
      [user] = await db.select().from(users).where(eq(users.openId, demo.openId)).limit(1);
    } else {
      await db
        .update(users)
        .set({
          email: demo.email,
          name: demo.name,
          loginMethod: "demo",
          role: demo.role,
          lastSignedIn: new Date(),
        })
        .where(eq(users.id, user.id));
      [user] = await db.select().from(users).where(eq(users.openId, demo.openId)).limit(1);
    }
    if (!user) throw new Error(`Failed to seed user ${demo.openId}`);
    seededUsers.push({
      id: user.id,
      email: user.email || demo.email,
      name: user.name || demo.name,
      openId: user.openId,
    });

    if (demo.firmRole) {
      const [member] = await db
        .select()
        .from(firmMembers)
        .where(eq(firmMembers.userId, user.id))
        .limit(1);
      if (!member) {
        await db.insert(firmMembers).values({
          firmId: firm.id,
          userId: user.id,
          firmRole: demo.firmRole,
          title: demo.firmRole === "admin" ? "Managing Partner" : "Associate",
          isActive: true,
        });
      }
    }
  }

  const clientUser = seededUsers.find((u) => u.openId === "demo-client")!;
  let [clientRow] = await db
    .select()
    .from(clients)
    .where(eq(clients.email, "client@demo.lexflow.ch"))
    .limit(1);
  if (!clientRow) {
    await db.insert(clients).values({
      firmId: firm.id,
      userId: clientUser.id,
      type: "individual",
      firstName: "Demo",
      lastName: "Client",
      email: "client@demo.lexflow.ch",
      status: "active",
      country: "Switzerland",
      termsAcceptedAt: new Date(),
      onboardingCompletedAt: new Date(),
    });
    [clientRow] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, "client@demo.lexflow.ch"))
      .limit(1);
  } else if (!clientRow.userId) {
    await db.update(clients).set({ userId: clientUser.id, status: "active" }).where(eq(clients.id, clientRow.id));
  }
  if (!clientRow) throw new Error("Failed to seed demo client");

  const adminUser = seededUsers.find((u) => u.openId === "demo-admin")!;
  let [caseRow] = await db
    .select()
    .from(cases)
    .where(eq(cases.referenceNumber, "DEMO-2026-001"))
    .limit(1);
  if (!caseRow) {
    await db.insert(cases).values({
      firmId: firm.id,
      title: "Demo employment dispute",
      referenceNumber: "DEMO-2026-001",
      type: "employment",
      status: "open",
      description: "Seeded demo case for smoke tests and online demos.",
      openedAt: new Date(),
      createdByUserId: adminUser.id,
    });
    [caseRow] = await db
      .select()
      .from(cases)
      .where(eq(cases.referenceNumber, "DEMO-2026-001"))
      .limit(1);
  }
  if (!caseRow) throw new Error("Failed to seed demo case");

  const lawyerUser = seededUsers.find((u) => u.openId === "demo-lawyer")!;
  for (const assignment of [
    { assignmentType: "lawyer" as const, userId: adminUser.id, clientId: null },
    { assignmentType: "lawyer" as const, userId: lawyerUser.id, clientId: null },
    { assignmentType: "client" as const, userId: null, clientId: clientRow.id },
  ]) {
    const existing = await db.select().from(caseAssignments).where(eq(caseAssignments.caseId, caseRow.id));
    const already = existing.some(
      (a) =>
        a.assignmentType === assignment.assignmentType &&
        a.userId === assignment.userId &&
        a.clientId === assignment.clientId
    );
    if (!already) {
      await db.insert(caseAssignments).values({
        caseId: caseRow.id,
        assignmentType: assignment.assignmentType,
        userId: assignment.userId,
        clientId: assignment.clientId,
        assignedByUserId: adminUser.id,
      });
    }
  }

  return {
    firmId: firm.id,
    caseId: caseRow.id,
    clientId: clientRow.id,
    users: seededUsers,
  };
}
