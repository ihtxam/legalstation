import { and, eq, gte, lte, or } from "drizzle-orm";
import {
  calendarImportedEvents,
  calendarPersonalEvents,
  caseTasks,
  clientActivities,
} from "../../drizzle/schema";
import { getDb, getFirmMemberByUserId, getCasesByFirm, getCasesByClientId, getClientByUserId } from "../db";
import type { AgendaItem } from "./types";

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function dayWindow(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return { start, end: endOfDay(d) };
}

/** Aggregate Cliavo + imported events for the signed-in user. */
export async function listUserAgenda(opts: {
  userId: number;
  from: Date;
  to: Date;
}): Promise<AgendaItem[]> {
  const db = await getDb();
  if (!db) return [];

  const items: AgendaItem[] = [];
  const member = await getFirmMemberByUserId(opts.userId);
  const client = member ? null : await getClientByUserId(opts.userId);

  // Case deadlines
  if (member) {
    const firmCases = await getCasesByFirm(member.firmId);
    for (const c of firmCases) {
      if (!c.deadline) continue;
      if (c.deadline < opts.from || c.deadline > opts.to) continue;
      const win = dayWindow(c.deadline);
      items.push({
        id: `case_deadline:${c.id}`,
        entityType: "case_deadline",
        entityId: c.id,
        title: `Deadline: ${c.title}`,
        description: c.referenceNumber || null,
        startsAt: win.start,
        endsAt: win.end,
        allDay: true,
        sourceLabel: "Case deadline",
        caseId: c.id,
      });
    }

    const tasks = await db
      .select()
      .from(caseTasks)
      .where(
        and(
          eq(caseTasks.firmId, member.firmId),
          gte(caseTasks.dueAt, opts.from),
          lte(caseTasks.dueAt, opts.to),
          or(eq(caseTasks.assigneeUserId, opts.userId), eq(caseTasks.createdByUserId, opts.userId))
        )
      );
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const win = dayWindow(t.dueAt);
      items.push({
        id: `case_task:${t.id}`,
        entityType: "case_task",
        entityId: t.id,
        title: t.title,
        description: t.description,
        startsAt: win.start,
        endsAt: win.end,
        allDay: true,
        sourceLabel: "Task",
        caseId: t.caseId,
      });
    }

    const activities = await db
      .select()
      .from(clientActivities)
      .where(
        and(
          eq(clientActivities.firmId, member.firmId),
          gte(clientActivities.dueAt, opts.from),
          lte(clientActivities.dueAt, opts.to),
          or(
            eq(clientActivities.assigneeUserId, opts.userId),
            eq(clientActivities.createdByUserId, opts.userId)
          )
        )
      );
    for (const a of activities) {
      if (!a.dueAt) continue;
      const start = a.dueAt;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      items.push({
        id: `client_activity:${a.id}`,
        entityType: "client_activity",
        entityId: a.id,
        title: a.title,
        description: a.body,
        startsAt: start,
        endsAt: end,
        allDay: false,
        sourceLabel: a.type || "Activity",
      });
    }
  } else if (client) {
    const myCases = await getCasesByClientId(client.id);
    for (const c of myCases) {
      if (!c.deadline) continue;
      if (c.deadline < opts.from || c.deadline > opts.to) continue;
      const win = dayWindow(c.deadline);
      items.push({
        id: `case_deadline:${c.id}`,
        entityType: "case_deadline",
        entityId: c.id,
        title: `Deadline: ${c.title}`,
        startsAt: win.start,
        endsAt: win.end,
        allDay: true,
        sourceLabel: "Case deadline",
        caseId: c.id,
      });
    }
  }

  const personal = await db
    .select()
    .from(calendarPersonalEvents)
    .where(
      and(
        eq(calendarPersonalEvents.userId, opts.userId),
        gte(calendarPersonalEvents.startsAt, opts.from),
        lte(calendarPersonalEvents.startsAt, opts.to)
      )
    );
  for (const p of personal) {
    items.push({
      id: `personal:${p.id}`,
      entityType: "personal",
      entityId: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      allDay: p.allDay,
      sourceLabel: "Personal",
    });
  }

  const imported = await db
    .select()
    .from(calendarImportedEvents)
    .where(
      and(
        eq(calendarImportedEvents.userId, opts.userId),
        gte(calendarImportedEvents.startsAt, opts.from),
        lte(calendarImportedEvents.startsAt, opts.to)
      )
    );
  for (const e of imported) {
    items.push({
      id: `imported:${e.id}`,
      entityType: "imported",
      entityId: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      sourceLabel: "External calendar",
    });
  }

  items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return items;
}
