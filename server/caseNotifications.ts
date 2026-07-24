import { eq, inArray } from "drizzle-orm";
import { caseAssignments, cases, clients, users } from "../drizzle/schema";
import { getDb } from "./db";

export type CaseNotifyRecipient = {
  email: string;
  name: string;
  kind: "lawyer" | "client";
};

/**
 * Resolve email recipients for case message/document notifications.
 * Excludes the actor user id when provided.
 */
export async function getCaseNotificationRecipients(
  caseId: number,
  excludeUserId?: number
): Promise<{ caseTitle: string; recipients: CaseNotifyRecipient[] }> {
  const db = await getDb();
  if (!db) return { caseTitle: `Case ${caseId}`, recipients: [] };

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  const caseTitle = caseRow?.title || `Case ${caseId}`;

  const assignments = await db
    .select()
    .from(caseAssignments)
    .where(eq(caseAssignments.caseId, caseId));

  const lawyerUserIds = assignments
    .filter((a) => a.assignmentType === "lawyer" && a.userId)
    .map((a) => a.userId!)
    .filter((id) => id !== excludeUserId);

  const clientIds = assignments
    .filter((a) => a.assignmentType === "client" && a.clientId)
    .map((a) => a.clientId!);

  const recipients: CaseNotifyRecipient[] = [];
  const seen = new Set<string>();

  if (lawyerUserIds.length) {
    const lawyerUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, lawyerUserIds));
    for (const u of lawyerUsers) {
      if (!u.email || seen.has(u.email.toLowerCase())) continue;
      if (excludeUserId && u.id === excludeUserId) continue;
      seen.add(u.email.toLowerCase());
      recipients.push({
        email: u.email,
        name: u.name || u.email,
        kind: "lawyer",
      });
    }
  }

  if (clientIds.length) {
    const clientRows = await db
      .select()
      .from(clients)
      .where(inArray(clients.id, clientIds));
    for (const c of clientRows) {
      if (!c.email || seen.has(c.email.toLowerCase())) continue;
      if (excludeUserId && c.userId === excludeUserId) continue;
      seen.add(c.email.toLowerCase());
      const name =
        c.type === "company"
          ? c.companyName || c.email
          : [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
      recipients.push({ email: c.email, name, kind: "client" });
    }
  }

  return { caseTitle, recipients };
}
