import { getCalendarOAuthConfig } from "../../platformCalendarConfig";
import type { CalendarProviderClient, ExternalCalendarEvent, UpsertExternalEventInput } from "../types";

const AUTH = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant || "common"}/oauth2/v2.0/authorize`;
const TOKEN = (tenant: string) =>
  `https://login.microsoftonline.com/${tenant || "common"}/oauth2/v2.0/token`;
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Calendars.ReadWrite", "User.Read", "offline_access", "openid", "email"].join(" ");

export async function microsoftCalendarConfigured() {
  const cfg = await getCalendarOAuthConfig();
  return cfg.microsoftConfigured;
}

export async function microsoftAuthorizeUrl(state: string, redirectUri: string) {
  const cfg = await getCalendarOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.microsoftClientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
  });
  return `${AUTH(cfg.microsoftTenant)}?${params.toString()}`;
}

export async function exchangeMicrosoftCode(code: string, redirectUri: string) {
  const cfg = await getCalendarOAuthConfig();
  const res = await fetch(TOKEN(cfg.microsoftTenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.microsoftClientId,
      client_secret: cfg.microsoftClientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Microsoft token exchange failed");
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const cfg = await getCalendarOAuthConfig();
  const res = await fetch(TOKEN(cfg.microsoftTenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.microsoftClientId,
      client_secret: cfg.microsoftClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Microsoft token refresh failed");
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function fetchMicrosoftAccountEmail(accessToken: string) {
  const res = await fetch(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return (data.mail || data.userPrincipalName || null) as string | null;
}

export function createMicrosoftCalendarClient(
  accessToken: string,
  calendarId?: string | null
): CalendarProviderClient {
  const base = calendarId
    ? `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`
    : `${GRAPH}/me/events`;

  return {
    async listEvents(from, to) {
      const filter = `start/dateTime ge '${from.toISOString()}' and end/dateTime le '${to.toISOString()}'`;
      const params = new URLSearchParams({
        $filter: filter,
        $orderby: "start/dateTime",
        $top: "250",
      });
      const res = await fetch(`${base}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Microsoft list events failed");
      return (data.value || []).map((ev: any): ExternalCalendarEvent => {
        const allDay = Boolean(ev.isAllDay);
        return {
          externalId: ev.id,
          title: ev.subject || "(No title)",
          description: ev.bodyPreview || null,
          location: ev.location?.displayName || null,
          startsAt: new Date(ev.start?.dateTime + "Z"),
          endsAt: new Date(ev.end?.dateTime + "Z"),
          allDay,
          etag: ev["@odata.etag"] || null,
          updatedAt: ev.lastModifiedDateTime ? new Date(ev.lastModifiedDateTime) : null,
        };
      });
    },

    async upsertEvent(input: UpsertExternalEventInput) {
      const body: any = {
        subject: input.title,
        body: input.description
          ? { contentType: "text", content: input.description }
          : undefined,
        location: input.location ? { displayName: input.location } : undefined,
        isAllDay: input.allDay,
        start: {
          dateTime: input.startsAt.toISOString().replace("Z", ""),
          timeZone: "UTC",
        },
        end: {
          dateTime: input.endsAt.toISOString().replace("Z", ""),
          timeZone: "UTC",
        },
      };
      const url = input.externalId ? `${base}/${encodeURIComponent(input.externalId)}` : base;
      const res = await fetch(url, {
        method: input.externalId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Microsoft upsert event failed");
      return { externalId: data.id as string, etag: data["@odata.etag"] as string | undefined };
    },

    async deleteEvent(externalId: string) {
      const res = await fetch(`${base}/${encodeURIComponent(externalId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Microsoft delete event failed");
      }
    },
  };
}
