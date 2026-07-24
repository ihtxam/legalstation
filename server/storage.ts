// Storage helpers: Forge (Manus), S3/MinIO, or local filesystem.

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getS3Client() {
  const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = ENV.s3;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 config missing: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  }
  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  const key = appendHashSuffix(normalizeKey(relKey));
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

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as BlobPart], { type: contentType });

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

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: `/manus-storage/${key}` };
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType: string,
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const fullPath = path.resolve(ENV.localUploadDir, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await fs.writeFile(fullPath, body);
  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  switch (ENV.storageBackend) {
    case "forge":
      return forgePut(relKey, data, contentType);
    case "s3":
      return s3Put(relKey, data, contentType);
    case "local":
    default:
      return localPut(relKey, data, contentType);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  if (ENV.storageBackend === "forge") {
    const forgeUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
    const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
    getUrl.searchParams.set("path", key);
    const resp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => resp.statusText);
      throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
    }
    const { url } = (await resp.json()) as { url: string };
    return url;
  }

  if (ENV.storageBackend === "s3") {
    const client = getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: ENV.s3.bucket, Key: key }),
      { expiresIn: 3600 },
    );
  }

  return `/manus-storage/${key}`;
}

export async function storageReadLocal(relKey: string): Promise<Buffer | null> {
  const key = normalizeKey(relKey);
  const fullPath = path.resolve(ENV.localUploadDir, key);
  try {
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}
