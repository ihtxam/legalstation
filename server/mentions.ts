import { eq, inArray } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { sendEmail } from "./email";

/** Parse @[123] style mentions from free text. */
export function extractMentionedUserIds(text: string | null | undefined): number[] {
  if (!text) return [];
  const ids = new Set<number>();
  const re = /@\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = Number(m[1]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return Array.from(ids);
}

export function mergeMentionIds(
  explicit: number[] | undefined,
  fromText: string | null | undefined
): number[] {
  const set = new Set<number>(explicit || []);
  for (const id of extractMentionedUserIds(fromText)) set.add(id);
  return Array.from(set);
}

export async function notifyMentionedUsers(opts: {
  userIds: number[];
  actorName: string;
  subject: string;
  preview: string;
  url: string;
  excludeUserId?: number;
}) {
  const ids = opts.userIds.filter((id) => id !== opts.excludeUserId);
  if (!ids.length) return;

  const db = await getDb();
  if (!db) return;

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(inArray(users.id, ids));

  await Promise.all(
    rows.map(async (u) => {
      if (!u.email) return;
      try {
        await sendEmail({
          to: [{ email: u.email, name: u.name || undefined }],
          subject: opts.subject,
          htmlContent: `
            <html><body style="font-family: Sora, Inter, sans-serif; color:#1a1a1a;">
              <div style="max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#7C3AED;">You were mentioned</h2>
                <p><strong>${opts.actorName}</strong> mentioned you:</p>
                <div style="background:#f5f5f5;padding:12px;border-left:4px solid #00BFA6;margin:16px 0;">
                  ${opts.preview.replace(/</g, "&lt;").slice(0, 500)}
                </div>
                <p><a href="${opts.url}" style="background:#00BFA6;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Open in Cliavo</a></p>
              </div>
            </body></html>
          `,
        });
      } catch (err) {
        console.error("[Mentions] notify failed for", u.email, err);
      }
    })
  );
}

export async function getUserEmailById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row?.email ?? null;
}
