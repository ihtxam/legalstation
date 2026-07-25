/** UUID helper that works on HTTP (non-secure) contexts where crypto.randomUUID is missing. */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ensure globalThis.crypto.randomUUID exists for third-party code. */
export function ensureRandomUUID(): void {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c) return;
  if (typeof c.randomUUID === "function") return;
  try {
    Object.defineProperty(c, "randomUUID", {
      value: () => randomId(),
      configurable: true,
    });
  } catch {
    // ignore if crypto is frozen
  }
}
