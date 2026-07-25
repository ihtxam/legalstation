/** Hard ceiling for multipart upload (matches multer limit). */
export const UPLOAD_HARD_MAX_BYTES = 50 * 1024 * 1024;

/** Default firm policy when not configured. */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Default allowed extensions (lowercase, no dot). */
export const DEFAULT_ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
] as const;

const EXT_TO_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/comma-separated-values"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
};

export type UploadPolicy = {
  maxUploadBytes: number;
  allowedExtensions: string[];
};

export function parseAllowedExtensions(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const list = parsed
        .map((x) => String(x).toLowerCase().replace(/^\./, "").trim())
        .filter(Boolean);
      return list.length ? list : [...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS];
    }
  } catch {
    // comma-separated fallback
    const list = raw
      .split(/[,\s]+/)
      .map((x) => x.toLowerCase().replace(/^\./, "").trim())
      .filter(Boolean);
    if (list.length) return list;
  }
  return [...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS];
}

export function resolveUploadPolicy(opts?: {
  maxUploadBytes?: number | null;
  allowedUploadTypes?: string | null;
}): UploadPolicy {
  const max = opts?.maxUploadBytes;
  const maxUploadBytes =
    typeof max === "number" && max > 0
      ? Math.min(Math.max(max, 100 * 1024), UPLOAD_HARD_MAX_BYTES)
      : DEFAULT_MAX_UPLOAD_BYTES;
  return {
    maxUploadBytes,
    allowedExtensions: parseAllowedExtensions(opts?.allowedUploadTypes),
  };
}

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  return base.slice(i + 1).toLowerCase();
}

export function mimeMatchesExtension(mimeType: string, ext: string): boolean {
  const allowed = EXT_TO_MIME[ext];
  if (!allowed) return true; // unknown mapping — rely on extension list
  const mime = (mimeType || "").toLowerCase().split(";")[0].trim();
  if (!mime || mime === "application/octet-stream") return true;
  return allowed.includes(mime);
}

export function acceptAttribute(extensions: string[]): string {
  return extensions.map((e) => `.${e}`).join(",");
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatAllowedTypesLabel(extensions: string[]): string {
  return extensions.map((e) => e.toUpperCase()).join(", ");
}

export type UploadValidationErrorCode = "FILE_TOO_LARGE" | "FILE_TYPE_NOT_ALLOWED";

export function validateUploadFile(input: {
  fileName: string;
  mimeType?: string | null;
  size: number;
  policy: UploadPolicy;
}): { ok: true } | { ok: false; code: UploadValidationErrorCode; message: string } {
  const ext = extensionOf(input.fileName);
  const { maxUploadBytes, allowedExtensions } = input.policy;

  if (input.size > maxUploadBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is too large. Maximum size is ${formatBytes(maxUploadBytes)}.`,
    };
  }

  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: `File type not allowed. Allowed: ${formatAllowedTypesLabel(allowedExtensions)}. Max size: ${formatBytes(maxUploadBytes)}.`,
    };
  }

  if (input.mimeType && !mimeMatchesExtension(input.mimeType, ext)) {
    return {
      ok: false,
      code: "FILE_TYPE_NOT_ALLOWED",
      message: `File type not allowed. Allowed: ${formatAllowedTypesLabel(allowedExtensions)}. Max size: ${formatBytes(maxUploadBytes)}.`,
    };
  }

  return { ok: true };
}

export function isImageUpload(mimeType?: string | null, fileName?: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const ext = extensionOf(fileName || "");
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
}
