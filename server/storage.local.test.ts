import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cliavo-storage-test-"));
  process.env.LOCAL_STORAGE_DIR = tmpDir;
  delete process.env.BUILT_IN_FORGE_API_URL;
  delete process.env.BUILT_IN_FORGE_API_KEY;
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("local-disk storage fallback", () => {
  it("stores and resolves files without Forge config", async () => {
    const { storagePut, resolveLocalStoragePath, isForgeStorageConfigured } = await import(
      "./storage"
    );
    expect(isForgeStorageConfigured()).toBe(false);

    const { key, url } = await storagePut("documents/test.txt", "hello cliavo", "text/plain");
    expect(url).toBe(`/manus-storage/${key}`);
    expect(key.startsWith("documents/test_")).toBe(true);

    const abs = resolveLocalStoragePath(key)!;
    const content = await fs.readFile(abs, "utf8");
    expect(content).toBe("hello cliavo");
  });

  it("appends a unique hash per upload (no overwrites)", async () => {
    const { storagePut } = await import("./storage");
    const a = await storagePut("documents/dup.txt", "a");
    const b = await storagePut("documents/dup.txt", "b");
    expect(a.key).not.toBe(b.key);
  });

  it("refuses path traversal outside the storage dir", async () => {
    const { resolveLocalStoragePath } = await import("./storage");
    expect(resolveLocalStoragePath("../../etc/passwd")).toBeNull();
    expect(resolveLocalStoragePath("documents/../../secret")).toBeNull();
    expect(resolveLocalStoragePath("documents/ok.pdf")).not.toBeNull();
  });

  it("storageGetSignedUrl returns proxy path in local mode", async () => {
    const { storageGetSignedUrl } = await import("./storage");
    expect(await storageGetSignedUrl("documents/x.pdf")).toBe("/manus-storage/documents/x.pdf");
  });
});
