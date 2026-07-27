import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  agencySettings,
  firmMembers,
  firms,
  supportTickets,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";
import { sendEmail } from "./email";
import { getAppBaseUrl } from "./tenant";

export const DEFAULT_TICKETS_PER_MONTH = 10;
export const RESOLVED_AUTO_CLOSE_DAYS = 7;

export type TicketStatus =
  | "open"
  | "processing"
  | "under_review"
  | "responded"
  | "resolved"
  | "closed";

export type TicketSensitivity = "low" | "medium" | "high" | "critical";

export async function getTicketsPerMonthLimit(): Promise<number> {
  const db = await getDb();
  if (!db) return DEFAULT_TICKETS_PER_MONTH;
  const [row] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "support_tickets_per_month"))
    .limit(1);
  const n = parseInt(row?.value || "", 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TICKETS_PER_MONTH;
  return Math.min(1000, Math.floor(n));
}

export async function countFirmTicketsThisMonth(firmId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(supportTickets)
    .where(and(eq(supportTickets.firmId, firmId), gte(supportTickets.createdAt, start)));
  return Number(row?.c || 0);
}

export async function nextTicketNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return `TKT-${Date.now()}`;
  const year = new Date().getUTCFullYear();
  const [row] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(supportTickets)
    .where(gte(supportTickets.createdAt, new Date(Date.UTC(year, 0, 1))));
  const seq = Number(row?.c || 0) + 1;
  return `TKT-${year}-${String(seq).padStart(5, "0")}`;
}

export function isFirmAdminRole(role: string | null | undefined) {
  return role === "admin" || role === "subadmin";
}

/** Firm staff who can open / follow platform support tickets (not portal clients). */
export function canUseSupportTickets(role: string | null | undefined) {
  return role === "admin" || role === "subadmin" || role === "lawyer" || role === "assistant";
}

export async function getPlatformNotifyEmails(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const emails = new Set<string>();
  const [support] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, "support_email"))
    .limit(1);
  if (support?.value?.includes("@")) emails.add(support.value.trim().toLowerCase());
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "superadmin"))
    .limit(20);
  for (const a of admins) {
    if (a.email?.includes("@")) emails.add(a.email.trim().toLowerCase());
  }
  return Array.from(emails);
}

export async function getFirmAdminEmails(firmId: number): Promise<Array<{ email: string; name: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      firmRole: firmMembers.firmRole,
    })
    .from(firmMembers)
    .innerJoin(users, eq(firmMembers.userId, users.id))
    .where(eq(firmMembers.firmId, firmId));
  return rows
    .filter((r) => isFirmAdminRole(r.firmRole) && r.email?.includes("@"))
    .map((r) => ({ email: r.email!, name: r.name }));
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyTicketCreated(opts: {
  ticketNumber: string;
  subject: string;
  body: string;
  sensitivity: string;
  firmName: string;
  creatorName: string;
  creatorEmail: string;
}) {
  const to = await getPlatformNotifyEmails();
  if (!to.length) return;
  const base = getAppBaseUrl();
  const html = `
    <html><body style="font-family:sans-serif;color:#1a1a1a">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#00BFA6">New support ticket ${esc(opts.ticketNumber)}</h2>
        <p><strong>Firm:</strong> ${esc(opts.firmName)}</p>
        <p><strong>From:</strong> ${esc(opts.creatorName)} (${esc(opts.creatorEmail)})</p>
        <p><strong>Sensitivity:</strong> ${esc(opts.sensitivity)}</p>
        <p><strong>Subject:</strong> ${esc(opts.subject)}</p>
        <p style="white-space:pre-wrap">${esc(opts.body)}</p>
        <p><a href="${base}/superadmin">Open superadmin panel</a></p>
      </div>
    </body></html>`;
  await Promise.allSettled(
    to.map((email) =>
      sendEmail({
        to: [{ email }],
        subject: `[Cliavo] ${opts.ticketNumber}: ${opts.subject}`,
        htmlContent: html,
      })
    )
  );
}

export async function notifyTicketReply(opts: {
  ticketNumber: string;
  subject: string;
  replyBody: string;
  toEmails: Array<{ email: string; name?: string | null }>;
  fromLabel: string;
  linkPath: string;
}) {
  if (!opts.toEmails.length) return;
  const base = getAppBaseUrl();
  const html = `
    <html><body style="font-family:sans-serif;color:#1a1a1a">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#00BFA6">Reply on ${esc(opts.ticketNumber)}</h2>
        <p><strong>From:</strong> ${esc(opts.fromLabel)}</p>
        <p><strong>Subject:</strong> ${esc(opts.subject)}</p>
        <p style="white-space:pre-wrap">${esc(opts.replyBody)}</p>
        <p><a href="${base}${opts.linkPath}">View ticket</a></p>
      </div>
    </body></html>`;
  await Promise.allSettled(
    opts.toEmails.map((r) =>
      sendEmail({
        to: [{ email: r.email, name: r.name || undefined }],
        subject: `[Cliavo] Re: ${opts.ticketNumber} — ${opts.subject}`,
        htmlContent: html,
      })
    )
  );
}

export async function notifyTicketStatusChange(opts: {
  ticketNumber: string;
  subject: string;
  status: string;
  toEmails: Array<{ email: string; name?: string | null }>;
}) {
  if (!opts.toEmails.length) return;
  const base = getAppBaseUrl();
  const html = `
    <html><body style="font-family:sans-serif;color:#1a1a1a">
      <div style="max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#00BFA6">Ticket ${esc(opts.ticketNumber)} updated</h2>
        <p>Status is now <strong>${esc(opts.status.replace(/_/g, " "))}</strong>.</p>
        <p><strong>Subject:</strong> ${esc(opts.subject)}</p>
        <p><a href="${base}/support">Open Support</a></p>
      </div>
    </body></html>`;
  await Promise.allSettled(
    opts.toEmails.map((r) =>
      sendEmail({
        to: [{ email: r.email, name: r.name || undefined }],
        subject: `[Cliavo] ${opts.ticketNumber} → ${opts.status}`,
        htmlContent: html,
      })
    )
  );
}

export function resolvedAutoCloseAt(from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + RESOLVED_AUTO_CLOSE_DAYS);
  return d;
}

/** Close tickets resolved with no firm reply for 7 days. */
export async function autoCloseResolvedTickets() {
  const db = await getDb();
  if (!db) return { closed: 0 };
  const now = new Date();
  const due = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.status, "resolved"),
        lt(supportTickets.autoCloseAt, now)
      )
    )
    .limit(200);

  let closed = 0;
  for (const t of due) {
    // Only auto-close if firm has not replied after resolve
    if (t.lastFirmReplyAt && t.resolvedAt && t.lastFirmReplyAt > t.resolvedAt) {
      continue;
    }
    await db
      .update(supportTickets)
      .set({ status: "closed", closedAt: now, updatedAt: now })
      .where(eq(supportTickets.id, t.id));
    closed += 1;
  }
  return { closed };
}

export async function getFirmName(firmId: number) {
  const db = await getDb();
  if (!db) return "Firm";
  const [f] = await db.select({ name: firms.name }).from(firms).where(eq(firms.id, firmId)).limit(1);
  return f?.name || "Firm";
}

export function ticketHasUnreadForFirm(t: {
  lastSuperadminReplyAt: Date | null;
  firmLastViewedAt: Date | null;
  status: string;
}) {
  if (!t.lastSuperadminReplyAt) return false;
  if (!t.firmLastViewedAt) return true;
  return t.lastSuperadminReplyAt.getTime() > t.firmLastViewedAt.getTime();
}
