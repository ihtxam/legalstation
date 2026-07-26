import { eq } from "drizzle-orm";
import { adyenAccounts } from "../drizzle/schema";
import { getDb } from "./db";
import { decryptSecret, encryptSecret } from "./calendar/tokenCrypto";

export type FirmAdyenConfig = {
  firmId: number;
  merchantAccount: string;
  apiKey: string;
  clientKey: string | null;
  hmacKey: string | null;
  environment: "test" | "live";
  isActive: boolean;
  lastWebhookAt: Date | null;
};

/** Load decrypted Adyen credentials for a firm (active only unless includeInactive). */
export async function getFirmAdyenConfig(
  firmId: number,
  opts?: { includeInactive?: boolean }
): Promise<FirmAdyenConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(adyenAccounts)
    .where(eq(adyenAccounts.firmId, firmId))
    .limit(1);
  if (!row) return null;
  if (!opts?.includeInactive && !row.isActive) return null;

  const apiKey = decryptSecret(row.apiKey) || (row.apiKey.startsWith("v1:") ? null : row.apiKey);
  if (!apiKey) return null;
  const hmacKey = row.hmacKey
    ? decryptSecret(row.hmacKey) || (row.hmacKey.startsWith("v1:") ? null : row.hmacKey)
    : null;

  return {
    firmId: row.firmId,
    merchantAccount: row.merchantAccount,
    apiKey,
    clientKey: row.clientKey || null,
    hmacKey,
    environment: row.environment === "live" ? "live" : "test",
    isActive: row.isActive,
    lastWebhookAt: row.lastWebhookAt,
  };
}

export async function getFirmAdyenByMerchantAccount(merchantAccount: string) {
  const db = await getDb();
  if (!db || !merchantAccount) return null;
  const [row] = await db
    .select()
    .from(adyenAccounts)
    .where(eq(adyenAccounts.merchantAccount, merchantAccount))
    .limit(1);
  if (!row || !row.isActive) return null;
  return getFirmAdyenConfig(row.firmId);
}

export async function upsertFirmAdyenAccount(input: {
  firmId: number;
  merchantAccount: string;
  apiKey?: string;
  clientKey?: string | null;
  hmacKey?: string | null;
  environment: "test" | "live";
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [existing] = await db
    .select()
    .from(adyenAccounts)
    .where(eq(adyenAccounts.firmId, input.firmId))
    .limit(1);

  const apiKeyEnc =
    input.apiKey && input.apiKey.trim()
      ? encryptSecret(input.apiKey.trim())
      : existing?.apiKey;
  if (!apiKeyEnc) throw new Error("API key is required");

  let hmacKeyEnc = existing?.hmacKey ?? null;
  if (input.hmacKey !== undefined) {
    hmacKeyEnc = input.hmacKey?.trim() ? encryptSecret(input.hmacKey.trim()) : null;
  }

  const values = {
    firmId: input.firmId,
    merchantAccount: input.merchantAccount.trim(),
    apiKey: apiKeyEnc,
    clientKey: input.clientKey === undefined ? existing?.clientKey ?? null : input.clientKey || null,
    hmacKey: hmacKeyEnc,
    environment: input.environment,
    isActive: input.isActive,
  };

  if (existing) {
    await db.update(adyenAccounts).set(values).where(eq(adyenAccounts.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(adyenAccounts).values(values);
  return Number(result[0].insertId);
}

export async function touchFirmAdyenWebhook(firmId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(adyenAccounts)
    .set({ lastWebhookAt: new Date() })
    .where(eq(adyenAccounts.firmId, firmId));
}

/** Public (non-secret) view for Settings UI. */
export async function getFirmAdyenPublic(firmId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(adyenAccounts)
    .where(eq(adyenAccounts.firmId, firmId))
    .limit(1);
  if (!row) return null;
  return {
    configured: true as const,
    merchantAccount: row.merchantAccount,
    clientKey: row.clientKey,
    environment: row.environment,
    isActive: row.isActive,
    hasApiKey: Boolean(row.apiKey),
    hasHmacKey: Boolean(row.hmacKey),
    lastWebhookAt: row.lastWebhookAt,
  };
}
