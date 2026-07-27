import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agencySettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { defaultLegalHtml } from "../../shared/grapesPage";

async function getMap(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(agencySettings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value ?? "";
  return map;
}

async function upsert(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.key, key))
    .limit(1);
  if (existing) {
    await db.update(agencySettings).set({ value }).where(eq(agencySettings.key, key));
  } else {
    await db.insert(agencySettings).values({ key, value });
  }
}

function resolveLegal(
  settings: Record<string, string>,
  key: "legal_terms_html" | "legal_privacy_html" | "legal_cookies_html",
  kind: "terms" | "privacy" | "cookies",
  brand: string
) {
  const stored = settings[key]?.trim();
  return stored || defaultLegalHtml(kind, brand);
}

export const platformLegalRouter = router({
  getPublic: publicProcedure.query(async () => {
    const settings = await getMap();
    const agencyName = settings.agency_name || "Cliavo";
    return {
      agencyName,
      termsHtml: resolveLegal(settings, "legal_terms_html", "terms", agencyName),
      privacyHtml: resolveLegal(settings, "legal_privacy_html", "privacy", agencyName),
      cookiesHtml: resolveLegal(settings, "legal_cookies_html", "cookies", agencyName),
      cookieBannerEnabled: settings.cookie_banner_enabled !== "false",
    };
  }),
});

export async function upsertPlatformLegal(input: {
  termsHtml?: string;
  privacyHtml?: string;
  cookiesHtml?: string;
  cookieBannerEnabled?: boolean;
}) {
  if (input.termsHtml !== undefined) await upsert("legal_terms_html", input.termsHtml);
  if (input.privacyHtml !== undefined) await upsert("legal_privacy_html", input.privacyHtml);
  if (input.cookiesHtml !== undefined) await upsert("legal_cookies_html", input.cookiesHtml);
  if (input.cookieBannerEnabled !== undefined) {
    await upsert("cookie_banner_enabled", input.cookieBannerEnabled ? "true" : "false");
  }
}

export const platformLegalAdminInput = z.object({
  termsHtml: z.string().max(200_000).optional(),
  privacyHtml: z.string().max(200_000).optional(),
  cookiesHtml: z.string().max(200_000).optional(),
  cookieBannerEnabled: z.boolean().optional(),
});
