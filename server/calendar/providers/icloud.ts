import { randomUUID } from "crypto";
import type { CalendarProviderClient, ExternalCalendarEvent, UpsertExternalEventInput } from "../types";

/**
 * iCloud Calendar via CalDAV + Apple app-specific password.
 * Username is typically the Apple ID email.
 */
export function createIcloudCalendarClient(opts: {
  username: string;
  appPassword: string;
  calendarUrl: string;
}): CalendarProviderClient {
  const auth =
    "Basic " + Buffer.from(`${opts.username}:${opts.appPassword}`).toString("base64");
  const calendarUrl = opts.calendarUrl.replace(/\/?$/, "/");

  async function dav(method: string, url: string, body?: string, extraHeaders?: Record<string, string>) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/xml; charset=utf-8",
        Depth: "1",
        ...extraHeaders,
      },
      body,
    });
    const text = await res.text();
    if (!res.ok && res.status !== 404) {
      throw new Error(`iCloud CalDAV ${method} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return { res, text };
  }

  function toIcal(input: UpsertExternalEventInput & { uid: string }) {
    const dt = (d: Date, allDay: boolean) =>
      allDay
        ? `;VALUE=DATE:${d.toISOString().slice(0, 10).replace(/-/g, "")}`
        : `:${d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
    const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,");
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cliavo//Calendar//EN",
      "BEGIN:VEVENT",
      `UID:${input.uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART${dt(input.startsAt, input.allDay)}`,
      `DTEND${dt(input.endsAt, input.allDay)}`,
      `SUMMARY:${esc(input.title)}`,
      input.description ? `DESCRIPTION:${esc(input.description)}` : "",
      input.location ? `LOCATION:${esc(input.location)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  }

  function parseEvents(xml: string): ExternalCalendarEvent[] {
    const blocks = xml.split(/BEGIN:VEVENT/i).slice(1);
    return blocks
      .map((block) => {
        const chunk = block.split(/END:VEVENT/i)[0] || "";
        const get = (key: string) => {
          const m = chunk.match(new RegExp(`^${key}[^:]*:(.+)$`, "im"));
          return m?.[1]?.trim() || null;
        };
        const uid = get("UID");
        if (!uid) return null;
        const parseDt = (prop: string): { date: Date; allDay: boolean } => {
          const line = chunk.match(new RegExp(`^${prop}([^:]*):(.+)$`, "im"));
          if (!line) return { date: new Date(), allDay: false };
          const params = line[1] || "";
          const val = line[2].trim();
          if (params.includes("VALUE=DATE") || /^\d{8}$/.test(val)) {
            const y = val.slice(0, 4);
            const mo = val.slice(4, 6);
            const d = val.slice(6, 8);
            return { date: new Date(`${y}-${mo}-${d}T00:00:00Z`), allDay: true };
          }
          const iso = val.endsWith("Z")
            ? `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}Z`
            : val;
          return { date: new Date(iso), allDay: false };
        };
        const start = parseDt("DTSTART");
        const end = parseDt("DTEND");
        return {
          externalId: uid,
          title: (get("SUMMARY") || "(No title)").replace(/\\n/g, "\n").replace(/\\,/g, ","),
          description: get("DESCRIPTION")?.replace(/\\n/g, "\n") || null,
          location: get("LOCATION"),
          startsAt: start.date,
          endsAt: end.date,
          allDay: start.allDay,
          etag: null,
          updatedAt: null,
        } satisfies ExternalCalendarEvent;
      })
      .filter(Boolean) as ExternalCalendarEvent[];
  }

  return {
    async listEvents(from, to) {
      const body = `<?xml version="1.0" encoding="utf-8" ?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${from.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}" end="${to.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
      const { text } = await dav("REPORT", calendarUrl, body, {
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
      });
      // Extract calendar-data CDATA-ish content
      const dataBlocks: string[] = [];
      const re = /calendar-data[^>]*>([\s\S]*?)<\//gi;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        dataBlocks.push(
          match[1]
            .replace(/<!\[CDATA\[/g, "")
            .replace(/\]\]>/g, "")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
        );
      }
      const events: ExternalCalendarEvent[] = [];
      for (const block of dataBlocks) events.push(...parseEvents(block));
      return events;
    },

    async upsertEvent(input: UpsertExternalEventInput) {
      const uid = input.externalId || `${randomUUID()}@cliavo`;
      const href = `${calendarUrl}${encodeURIComponent(uid)}.ics`;
      const ical = toIcal({ ...input, uid });
      const { res } = await dav("PUT", href, ical, {
        "Content-Type": "text/calendar; charset=utf-8",
      });
      if (!res.ok) throw new Error(`iCloud PUT failed (${res.status})`);
      return { externalId: uid, etag: res.headers.get("etag") || undefined };
    },

    async deleteEvent(externalId: string) {
      const href = `${calendarUrl}${encodeURIComponent(externalId)}.ics`;
      await dav("DELETE", href);
    },
  };
}

/** Discover a usable calendar URL after validating credentials. */
export async function discoverIcloudCalendarUrl(username: string, appPassword: string) {
  const auth = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
  // Well-known principal discovery
  const principalRes = await fetch("https://caldav.icloud.com/", {
    method: "PROPFIND",
    headers: {
      Authorization: auth,
      Depth: "0",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
  });
  const principalXml = await principalRes.text();
  if (!principalRes.ok) {
    throw new Error("iCloud login failed. Use your Apple ID and an app-specific password.");
  }
  const principalHref =
    principalXml.match(/<[^>]*current-user-principal[^>]*>\s*<[^>]*href[^>]*>([^<]+)</i)?.[1] ||
    principalXml.match(/href>([^<]+)</i)?.[1];
  if (!principalHref) throw new Error("Could not resolve iCloud calendar principal.");

  const principalUrl = principalHref.startsWith("http")
    ? principalHref
    : `https://caldav.icloud.com${principalHref}`;

  const homeRes = await fetch(principalUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: auth,
      Depth: "0",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
  });
  const homeXml = await homeRes.text();
  const homeHref =
    homeXml.match(/calendar-home-set[\s\S]*?<[^>]*href[^>]*>([^<]+)</i)?.[1] ||
    homeXml.match(/href>([^<]+calendars[^<]*)</i)?.[1];
  if (!homeHref) throw new Error("Could not resolve iCloud calendar home.");
  const homeUrl = homeHref.startsWith("http") ? homeHref : `https://caldav.icloud.com${homeHref}`;

  const listRes = await fetch(homeUrl.replace(/\/?$/, "/"), {
    method: "PROPFIND",
    headers: {
      Authorization: auth,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>`,
  });
  const listXml = await listRes.text();
  const responses = listXml.split(/<[^>]*response[^>]*>/i).slice(1);
  for (const r of responses) {
    if (/calendar/.test(r) && !/inbox|outbox|notification/i.test(r)) {
      const href = r.match(/href>([^<]+)</i)?.[1];
      if (href && href !== homeHref) {
        return href.startsWith("http") ? href.replace(/\/?$/, "/") : `https://caldav.icloud.com${href}`.replace(/\/?$/, "/");
      }
    }
  }
  return homeUrl.replace(/\/?$/, "/");
}
