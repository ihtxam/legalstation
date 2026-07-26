import { UPLOAD_URL } from "../config";
import { getSessionToken } from "../auth/session";

export type UploadedFile = {
  key: string;
  url: string;
};

export type LocalFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

/** Multipart upload to Cliavo `/api/upload`, then register via tRPC. */
export async function uploadFile(file: LocalFile): Promise<UploadedFile> {
  const token = await getSessionToken();
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as unknown as Blob);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed");
  }
  return { key: data.key, url: data.url };
}
