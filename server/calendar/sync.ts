import { and, eq } from "drizzle-orm";
import {
  calendarConnections,
  calendarEventLinks,
  calendarImportedEvents,
  type CalendarConnection,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { listUserAgenda } from "./agenda";
import { decryptSecret, encryptSecret } from "./tokenCrypto";
import {
  createGoogleCalendarClient,
  refreshGoogleAccessToken,
} from "./providers/google";
import {
  createMicrosoftCalendarClient,
  refreshMicrosoftAccessToken,
} from "./providers/microsoft";
import { createIcloudCalendarClient } from "./providers/icloud";
import type { AgendaItem, CalendarProviderClient } from "./types";

async function getValidAccessToken(conn: CalendarConnection): Promise<string | null> {
  if (conn.provider === "icloud") return null;
  const access = decryptSecret(conn.accessTokenEnc);
  const refresh = decryptSecret(conn.refreshTokenEnc);
  const expires = conn.tokenExpiresAt?.getTime() || 0;
  if (access && expires > Date.now() + 60_000) return access;
  if (!refresh) return access;

  if (conn.provider === "google") {
    const tok = await refreshGoogleAccessToken(refresh);
    const db = await getDb();
    if (db) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEnc: encryptSecret(tok.access_token),
          tokenExpiresAt: new Date(Date.now() + tok.expires_in * 1000),
        })
        .where(eq(calendarConnections.id, conn.id));
    }
    return tok.access_token;
  }
  if (conn.provider === "microsoft") {
    const tok = await refreshMicrosoftAccessToken(refresh);
    const db = await getDb();
    if (db) {
      await db
        .update(calendarConnections)
        .set({
          accessTokenEnc: encryptSecret(tok.access_token),
          refreshTokenEnc: tok.refresh_token
            ? encryptSecret(tok.refresh_token)
            : conn.refreshTokenEnc,
          tokenExpiresAt: new Date(Date.now() + tok.expires_in * 1000),
        })
        .where(eq(calendarConnections.id, conn.id));
    }
    return tok.access_token;
  }
  return access;
}

async function buildClient(conn: CalendarConnection): Promise<CalendarProviderClient> {
  if (conn.provider === "icloud") {
    const password = decryptSecret(conn.refreshTokenEnc);
    if (!password || !conn.caldavUsername || !conn.caldavUrl) {
      throw new Error("iCloud credentials incomplete");
    }
    return createIcloudCalendarClient({
      username: conn.caldavUsername,
      appPassword: password,
      calendarUrl: conn.externalCalendarId || conn.caldavUrl,
    });
  }
  const token = await getValidAccessToken(conn);
  if (!token) throw new Error("Missing access token");
  if (conn.provider === "google") {
    return createGoogleCalendarClient(token, conn.externalCalendarId || "primary");
  }
  return createMicrosoftCalendarClient(token, conn.externalCalendarId);
}

function pushable(items: AgendaItem[]) {
  return items.filter((i) => i.entityType !== "imported");
}

export async function syncConnection(connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [conn] = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId))
    .limit(1);
  if (!conn || !conn.syncEnabled) return { pushed: 0, pulled: 0 };

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  let pushed = 0;
  let pulled = 0;

  try {
    const client = await buildClient(conn);
    const direction = conn.syncDirection || "both";

    if (direction === "both" || direction === "push") {
      const agenda = pushable(await listUserAgenda({ userId: conn.userId, from, to }));
      for (const item of agenda) {
        const [link] = await db
          .select()
          .from(calendarEventLinks)
          .where(
            and(
              eq(calendarEventLinks.connectionId, conn.id),
              eq(calendarEventLinks.entityType, item.entityType),
              eq(calendarEventLinks.entityId, item.entityId)
            )
          )
          .limit(1);

        const result = await client.upsertEvent({
          externalId: link?.externalEventId,
          title: item.title,
          description: [item.description, item.sourceLabel].filter(Boolean).join("\n") || null,
          location: item.location,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          allDay: item.allDay,
        });

        if (link) {
          await db
            .update(calendarEventLinks)
            .set({
              externalEventId: result.externalId,
              etag: result.etag || null,
              lastPushedAt: new Date(),
            })
            .where(eq(calendarEventLinks.id, link.id));
        } else {
          await db.insert(calendarEventLinks).values({
            connectionId: conn.id,
            entityType: item.entityType,
            entityId: item.entityId,
            externalEventId: result.externalId,
            etag: result.etag || null,
            lastPushedAt: new Date(),
          });
        }
        pushed += 1;
      }
    }

    if (direction === "both" || direction === "pull") {
      const external = await client.listEvents(from, to);
      const links = await db
        .select()
        .from(calendarEventLinks)
        .where(eq(calendarEventLinks.connectionId, conn.id));
      const pushedExternalIds = new Set(links.map((l) => l.externalEventId));

      for (const ev of external) {
        if (pushedExternalIds.has(ev.externalId)) continue;
        const [existing] = await db
          .select()
          .from(calendarImportedEvents)
          .where(
            and(
              eq(calendarImportedEvents.connectionId, conn.id),
              eq(calendarImportedEvents.externalEventId, ev.externalId)
            )
          )
          .limit(1);
        if (existing) {
          await db
            .update(calendarImportedEvents)
            .set({
              title: ev.title,
              description: ev.description,
              location: ev.location,
              startsAt: ev.startsAt,
              endsAt: ev.endsAt,
              allDay: ev.allDay,
              etag: ev.etag || null,
              rawUpdatedAt: ev.updatedAt || null,
            })
            .where(eq(calendarImportedEvents.id, existing.id));
        } else {
          await db.insert(calendarImportedEvents).values({
            connectionId: conn.id,
            userId: conn.userId,
            externalEventId: ev.externalId,
            title: ev.title,
            description: ev.description,
            location: ev.location,
            startsAt: ev.startsAt,
            endsAt: ev.endsAt,
            allDay: ev.allDay,
            etag: ev.etag || null,
            rawUpdatedAt: ev.updatedAt || null,
          });
        }
        pulled += 1;
      }
    }

    await db
      .update(calendarConnections)
      .set({ lastSyncedAt: new Date(), lastError: null })
      .where(eq(calendarConnections.id, conn.id));

    return { pushed, pulled };
  } catch (err: any) {
    await db
      .update(calendarConnections)
      .set({ lastError: err?.message || "Sync failed" })
      .where(eq(calendarConnections.id, conn.id));
    throw err;
  }
}

export async function syncAllEnabledConnections() {
  const db = await getDb();
  if (!db) return { connections: 0, errors: 0 };
  const rows = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.syncEnabled, true));
  let errors = 0;
  for (const row of rows) {
    try {
      await syncConnection(row.id);
    } catch {
      errors += 1;
    }
  }
  return { connections: rows.length, errors };
}
