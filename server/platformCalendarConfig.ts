import { ENV } from "./_core/env";
import { getDb } from "./db";
import { agencySettings } from "../drizzle/schema";
import { decryptSecret, encryptSecret } from "./calendar/tokenCrypto";

type CalendarOAuthConfig = {
  googleClientId: string;
  googleClientSecret: string;
  microsoftClientId: string;
  microsoftClientSecret: string;
  microsoftTenant: string;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
  source: "agency_settings" | "env" | "mixed";
};

let cache: { at: number; value: CalendarOAuthConfig } | null = null;
const CACHE_MS = 30_000;

async function readAgencyMap(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(agencySettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function maybeDecrypt(value: string | undefined): string {
  if (!value) return "";
  if (value.startsWith("v1:")) return decryptSecret(value) || "";
  return value;
}

export function clearCalendarOAuthConfigCache() {
  cache = null;
}

/** Resolve platform calendar OAuth credentials: agency_settings override ENV. */
export async function getCalendarOAuthConfig(): Promise<CalendarOAuthConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const settings = await readAgencyMap();

  const googleClientId =
    settings.google_calendar_client_id?.trim() || ENV.googleCalendarClientId || "";
  const googleClientSecret =
    maybeDecrypt(settings.google_calendar_client_secret) || ENV.googleCalendarClientSecret || "";
  const microsoftClientId =
    settings.microsoft_calendar_client_id?.trim() || ENV.microsoftCalendarClientId || "";
  const microsoftClientSecret =
    maybeDecrypt(settings.microsoft_calendar_client_secret) ||
    ENV.microsoftCalendarClientSecret ||
    "";
  const microsoftTenant =
    settings.microsoft_calendar_tenant?.trim() || ENV.microsoftCalendarTenant || "common";

  const fromAgency = Boolean(
    settings.google_calendar_client_id ||
      settings.google_calendar_client_secret ||
      settings.microsoft_calendar_client_id ||
      settings.microsoft_calendar_client_secret
  );
  const fromEnv = Boolean(
    ENV.googleCalendarClientId ||
      ENV.googleCalendarClientSecret ||
      ENV.microsoftCalendarClientId ||
      ENV.microsoftCalendarClientSecret
  );

  const value: CalendarOAuthConfig = {
    googleClientId,
    googleClientSecret,
    microsoftClientId,
    microsoftClientSecret,
    microsoftTenant,
    googleConfigured: Boolean(googleClientId && googleClientSecret),
    microsoftConfigured: Boolean(microsoftClientId && microsoftClientSecret),
    source: fromAgency && fromEnv ? "mixed" : fromAgency ? "agency_settings" : "env",
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function upsertCalendarOAuthSettings(input: {
  googleClientId?: string;
  googleClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  microsoftTenant?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const pairs: Array<[string, string]> = [];
  if (input.googleClientId !== undefined) {
    pairs.push(["google_calendar_client_id", input.googleClientId.trim()]);
  }
  if (input.googleClientSecret?.trim()) {
    pairs.push(["google_calendar_client_secret", encryptSecret(input.googleClientSecret.trim())]);
  }
  if (input.microsoftClientId !== undefined) {
    pairs.push(["microsoft_calendar_client_id", input.microsoftClientId.trim()]);
  }
  if (input.microsoftClientSecret?.trim()) {
    pairs.push([
      "microsoft_calendar_client_secret",
      encryptSecret(input.microsoftClientSecret.trim()),
    ]);
  }
  if (input.microsoftTenant !== undefined) {
    pairs.push(["microsoft_calendar_tenant", input.microsoftTenant.trim() || "common"]);
  }
  for (const [key, value] of pairs) {
    await db
      .insert(agencySettings)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
  }
  clearCalendarOAuthConfigCache();
}
