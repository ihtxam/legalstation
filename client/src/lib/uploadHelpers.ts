import {
  acceptAttribute,
  formatAllowedTypesLabel,
  formatBytes,
  validateUploadFile,
  type UploadPolicy,
} from "@shared/uploadPolicy";

export function uploadPolicyHint(policy: UploadPolicy): string {
  return `Allowed: ${formatAllowedTypesLabel(policy.allowedExtensions)}. Max size: ${formatBytes(policy.maxUploadBytes)}.`;
}

export function fileAccept(policy: UploadPolicy): string {
  return acceptAttribute(policy.allowedExtensions);
}

export function precheckFile(file: File, policy: UploadPolicy): string | null {
  const result = validateUploadFile({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    policy,
  });
  return result.ok ? null : result.message;
}

export async function postFileUpload(file: File): Promise<{ fileKey: string; fileUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Upload failed");
  }
  // /api/upload returns { key, url }; accept the older { fileKey, fileUrl } shape too.
  const fileKey = data.key || data.fileKey;
  const fileUrl = data.url || data.fileUrl;
  if (!fileKey || !fileUrl) {
    throw new Error(data.error || "Upload failed");
  }
  return { fileKey, fileUrl };
}
