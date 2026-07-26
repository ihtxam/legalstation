import type { Request } from "express";
import { eq } from "drizzle-orm";
import { firms } from "../drizzle/schema";
import { getDb, getFirmBySlug } from "./db";
import { ENV } from "./_core/env";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "platform",
  "superadmin",
  "mail",
  "status",
  "legal",
  "demo",
  "staging",
]);

export function getAppBaseUrl(req?: Request): string {
  if (ENV.appUrl) return ENV.appUrl.replace(/\/$/, "");
  if (req) {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/** Extract subdomain from Host against APP_BASE_DOMAIN (e.g. firm.cliavo.ch → firm). */
export function extractSubdomain(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  const base = (ENV.appBaseDomain || "").toLowerCase().replace(/^\./, "");
  if (!base || !host.endsWith(base)) return null;
  if (host === base || host === `www.${base}`) return null;
  const sub = host.slice(0, -(base.length + 1));
  if (!sub || sub.includes(".")) return null;
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.toLowerCase());
}

export async function resolveFirmFromHost(req: Request) {
  const hostHeader = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  const host = hostHeader?.split(":")[0]?.toLowerCase();
  if (!host) return null;

  const db = await getDb();
  if (!db) return null;

  try {
    // Custom domain exact match
    const byDomain = await db
      .select()
      .from(firms)
      .where(eq(firms.customDomain, host))
      .limit(1);
    if (byDomain[0] && byDomain[0].subdomainStatus === "active") {
      return byDomain[0];
    }

    const sub = extractSubdomain(hostHeader);
    if (!sub) return null;
    const firm = await getFirmBySlug(sub);
    if (!firm) return null;
    if (firm.subdomainStatus === "rejected") return null;
    return firm;
  } catch (err) {
    // Schema may be mid-migration; never crash the process for host branding.
    console.warn("[Tenant] resolveFirmFromHost failed", err);
    return null;
  }
}

export function firmLoginUrl(firmSlug: string, req?: Request): string {
  const baseDomain = ENV.appBaseDomain;
  if (baseDomain) {
    const proto = ENV.isProduction ? "https" : "http";
    return `${proto}://${firmSlug}.${baseDomain}/login`;
  }
  return `${getAppBaseUrl(req)}/login?firm=${encodeURIComponent(firmSlug)}`;
}

export function platformLoginUrl(req?: Request): string {
  return `${getAppBaseUrl(req)}/platform/login`;
}

/** Apex used for firm subdomains; falls back to hostname of APP_URL when unset. */
export function getFirmBaseDomain(): string | null {
  const configured = (ENV.appBaseDomain || "").toLowerCase().replace(/^\./, "").trim();
  if (configured) return configured;
  try {
    if (ENV.appUrl) return new URL(ENV.appUrl).hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

/** Public website URLs for a firm (path-based always works; subdomain when DNS/base domain ready). */
export function firmPublicSiteUrls(
  firm: { slug: string | null; customDomain?: string | null; subdomainStatus?: string | null },
  req?: Request
) {
  const appBase = getAppBaseUrl(req);
  const slug = (firm.slug || "").trim();
  const pathHome = slug ? `${appBase}/site/${encodeURIComponent(slug)}` : null;
  const baseDomain = getFirmBaseDomain();
  const proto = ENV.isProduction ? "https" : "http";
  const subdomainHome =
    slug && baseDomain ? `${proto}://${slug}.${baseDomain}` : null;
  const customHome =
    firm.customDomain && firm.subdomainStatus === "active"
      ? `${proto}://${firm.customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : null;

  return {
    pathHome,
    pathPage: (pageSlug: string) =>
      pathHome ? `${pathHome}/${encodeURIComponent(pageSlug)}` : null,
    subdomainHome,
    subdomainPage: (pageSlug: string) =>
      subdomainHome ? `${subdomainHome}/${encodeURIComponent(pageSlug)}` : null,
    customHome,
    customPage: (pageSlug: string) =>
      customHome ? `${customHome}/${encodeURIComponent(pageSlug)}` : null,
    preferredHome: customHome || subdomainHome || pathHome,
    baseDomain,
  };
}
