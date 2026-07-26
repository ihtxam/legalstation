import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_UPLOAD_POLICY,
  formatBytes,
  validateUploadFile,
  resolveUploadPolicy,
} from "../shared/uploadPolicy";

describe("uploadPolicy", () => {
  it("allows jpeg within size limit", () => {
    const policy = resolveUploadPolicy();
    const result = validateUploadFile({
      fileName: "scan.jpeg",
      mimeType: "image/jpeg",
      size: 1_000_000,
      policy,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects oversized files with a clear message", () => {
    const policy = resolveUploadPolicy({ maxUploadBytes: 2 * 1024 * 1024 });
    const result = validateUploadFile({
      fileName: "big.pdf",
      mimeType: "application/pdf",
      size: 3 * 1024 * 1024,
      policy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_TOO_LARGE");
      expect(result.message).toContain("2 MB");
    }
  });

  it("rejects disallowed extensions", () => {
    const policy = resolveUploadPolicy({
      allowedUploadTypes: JSON.stringify(["pdf", "docx"]),
    });
    const result = validateUploadFile({
      fileName: "photo.exe",
      mimeType: "application/octet-stream",
      size: 1000,
      policy,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_TYPE_NOT_ALLOWED");
      expect(result.message).toContain("PDF");
    }
  });

  it("defaults max size to 10 MB", () => {
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(formatBytes(DEFAULT_MAX_UPLOAD_BYTES)).toBe("10 MB");
  });

  it("enforces 1 MB max for support ticket attachments", () => {
    expect(TICKET_ATTACHMENT_MAX_BYTES).toBe(1 * 1024 * 1024);
    const ok = validateUploadFile({
      fileName: "note.pdf",
      mimeType: "application/pdf",
      size: 900_000,
      policy: TICKET_UPLOAD_POLICY,
    });
    expect(ok.ok).toBe(true);
    const tooBig = validateUploadFile({
      fileName: "note.pdf",
      mimeType: "application/pdf",
      size: 1_200_000,
      policy: TICKET_UPLOAD_POLICY,
    });
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) {
      expect(tooBig.code).toBe("FILE_TOO_LARGE");
      expect(tooBig.message).toContain("1 MB");
    }
  });
});
