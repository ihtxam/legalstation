// Storage helpers with two backends:
//  1. Forge presigned-URL S3 storage (when BUILT_IN_FORGE_API_URL/KEY are set)
//  2. Local-disk fallback (LOCAL_STORAGE_DIR, default ./data/storage) so
//     document/logo/attachment uploads work on self-hosted deployments
//     without any external storage service.
// Both backends expose files under /manus-storage/{key} (see storageProxy).

import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ENV } from "./_core/env";

export function isForgeStorageConfigured(): boolean {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

export function getLocalStorageDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "data", "storage"));
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/** Resolve a storage key to an absolute local path, refusing traversal outside the storage dir. */
export function resolveLocalStoragePath(relKey: string): string | null {
  const base = getLocalStorageDir();
  const abs = path.resolve(base, normalizeKey(relKey));
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

async function localPut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const abs = resolveLocalStoragePath(key);
  if (!abs) throw new Error("Invalid storage key");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buf =
    typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data as Uint8Array);
  await fs.writeFile(abs, buf);
  // Content type is re-derived from the extension when serving; nothing else to persist.
  void contentType;
  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  if (!isForgeStorageConfigured()) {
    return localPut(key, data, contentType);
  }

  const { forgeUrl, forgeKey } = getForgeConfig();

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  if (!isForgeStorageConfigured()) {
    return `/manus-storage/${key}`;
  }

  const { forgeUrl, forgeKey } = getForgeConfig();

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
