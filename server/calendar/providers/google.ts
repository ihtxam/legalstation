import { ENV } from "../../_core/env";
import type { CalendarProviderClient, ExternalCalendarEvent, UpsertExternalEventInput } from "../types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = ["https://www.googleapis.com/auth/calendar", "email", "profile"].join(" ");

export function googleCalendarConfigured() {
  return Boolean(ENV.googleCalendarClientId && ENV.googleCalendarClientSecret);
}

export function googleAuthorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: ENV.googleCalendarClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleCalendarClientId,
      client_secret: ENV.googleCalendarClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token exchange failed");
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.googleCalendarClientId,
      client_secret: ENV.googleCalendarClientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token refresh failed");
  return data as { access_token: string; expires_in: number };
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return (data.email as string) || null;
}

export function createGoogleCalendarClient(
  accessToken: string,
  calendarId = "primary"
): CalendarProviderClient {
  const cal = encodeURIComponent(calendarId || "primary");

  return {
    async listEvents(from, to) {
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      const res = await fetch(`${GOOGLE_API}/calendars/${cal}/events?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Google list events failed");
      return (data.items || []).map((ev: any): ExternalCalendarEvent => {
        const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
        const startsAt = new Date(ev.start?.dateTime || `${ev.start?.date}T00:00:00Z`);
        const endsAt = new Date(ev.end?.dateTime || `${ev.end?.date}T00:00:00Z`);
        return {
          externalId: ev.id,
          title: ev.summary || "(No title)",
          description: ev.description || null,
          location: ev.location || null,
          startsAt,
          endsAt,
          allDay,
          etag: ev.etag || null,
          updatedAt: ev.updated ? new Date(ev.updated) : null,
        };
      });
    },

    async upsertEvent(input: UpsertExternalEventInput) {
      const body: any = {
        summary: input.title,
        description: input.description || undefined,
        location: input.location || undefined,
      };
      if (input.allDay) {
        body.start = { date: input.startsAt.toISOString().slice(0, 10) };
        body.end = { date: input.endsAt.toISOString().slice(0, 10) };
      } else {
        body.start = { dateTime: input.startsAt.toISOString() };
        body.end = { dateTime: input.endsAt.toISOString() };
      }

      const url = input.externalId
        ? `${GOOGLE_API}/calendars/${cal}/events/${encodeURIComponent(input.externalId)}`
        : `${GOOGLE_API}/calendars/${cal}/events`;
      const res = await fetch(url, {
        method: input.externalId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Google upsert event failed");
      return { externalId: data.id as string, etag: data.etag as string | undefined };
    },

    async deleteEvent(externalId: string) {
      const res = await fetch(
        `${GOOGLE_API}/calendars/${cal}/events/${encodeURIComponent(externalId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Google delete event failed");
      }
    },
  };
}
