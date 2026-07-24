import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Express } from "express";
import { ENV } from "./env";
import { storageGetSignedUrl, storageReadLocal } from "../storage";

function getS3Client() {
  return new S3Client({
    region: ENV.s3.region,
    endpoint: ENV.s3.endpoint || undefined,
    forcePathStyle: ENV.s3.forcePathStyle,
    credentials: {
      accessKeyId: ENV.s3.accessKeyId,
      secretAccessKey: ENV.s3.secretAccessKey,
    },
  });
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      if (ENV.storageBackend === "local") {
        const data = await storageReadLocal(key);
        if (!data) {
          res.status(404).send("Not found");
          return;
        }
        res.set("Cache-Control", "private, max-age=3600");
        res.send(data);
        return;
      }

      if (ENV.storageBackend === "s3") {
        if (!ENV.s3.accessKeyId || !ENV.s3.secretAccessKey) {
          res.status(500).send("S3 storage not configured");
          return;
        }
        // Stream through the app so browsers never need the internal MinIO host.
        const client = getS3Client();
        const obj = await client.send(
          new GetObjectCommand({ Bucket: ENV.s3.bucket, Key: key }),
        );
        if (obj.ContentType) res.set("Content-Type", obj.ContentType);
        if (obj.ContentLength != null) res.set("Content-Length", String(obj.ContentLength));
        res.set("Cache-Control", "private, max-age=3600");
        const body = obj.Body;
        if (!body) {
          res.status(404).send("Not found");
          return;
        }
        const bytes = await body.transformToByteArray();
        res.send(Buffer.from(bytes));
        return;
      }

      if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
        res.status(500).send("Storage proxy not configured");
        return;
      }

      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
