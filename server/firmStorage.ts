import { and, eq, sql } from "drizzle-orm";
import type { Request } from "express";
import { clients, documents, firms } from "../drizzle/schema";
import { getDb, getFirmMemberByUserId } from "./db";
import { sdk } from "./_core/sdk";

export const DEFAULT_STORAGE_QUOTA_BYTES = 10_737_418_240; // 10 GB
export const STORAGE_PRESETS_GB = [2, 10, 50] as const;

export function gbToBytes(gb: number) {
  return Math.round(gb * 1024 * 1024 * 1024);
}

export function bytesToGbLabel(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (Math.abs(gb - Math.round(gb)) < 0.05) return `${Math.round(gb)} GB`;
  return `${gb.toFixed(1)} GB`;
}

export async function getFirmStorageUsage(firmId: number) {
  const db = await getDb();
  if (!db) {
    return {
      usedBytes: 0,
      quotaBytes: DEFAULT_STORAGE_QUOTA_BYTES,
      remainingBytes: DEFAULT_STORAGE_QUOTA_BYTES,
      percentUsed: 0,
    };
  }
  const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
  const quotaBytes = Number(firm?.storageQuotaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES);
  const [row] = await db
    .select({
      used: sql<string>`COALESCE(SUM(${documents.size}), 0)`,
    })
    .from(documents)
    .where(and(eq(documents.firmId, firmId), eq(documents.isDeleted, false)));
  const usedBytes = Number(row?.used || 0);
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const percentUsed = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  return { usedBytes, quotaBytes, remainingBytes, percentUsed };
}

/** Returns null if OK, or an error message if the upload would exceed quota. */
export async function assertFirmStorageAllows(
  firmId: number,
  additionalBytes: number
): Promise<string | null> {
  const usage = await getFirmStorageUsage(firmId);
  if (usage.usedBytes + additionalBytes > usage.quotaBytes) {
    return `Firm storage quota exceeded (${bytesToGbLabel(usage.usedBytes)} / ${bytesToGbLabel(usage.quotaBytes)}). Contact Cliavo support or upgrade your plan.`;
  }
  return null;
}

export async function resolveFirmIdForUser(userId: number): Promise<number | null> {
  const member = await getFirmMemberByUserId(userId);
  if (member) return member.firmId;
  const db = await getDb();
  if (!db) return null;
  const [client] = await db
    .select({ firmId: clients.firmId })
    .from(clients)
    .where(eq(clients.userId, userId))
    .limit(1);
  return client?.firmId ?? null;
}

export async function resolveFirmIdFromRequest(req: Request): Promise<number | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user?.id) return resolveFirmIdForUser(user.id);
  } catch {
    // unauthenticated
  }
  return null;
}
