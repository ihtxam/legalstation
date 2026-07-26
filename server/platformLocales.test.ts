import { describe, expect, it } from "vitest";
import { isAppLocale } from "../shared/locales";

describe("platform locale filtering", () => {
  it("recognizes only product locales", () => {
    expect(isAppLocale("ar")).toBe(true);
    expect(isAppLocale("it")).toBe(true);
    expect(isAppLocale("pt")).toBe(false);
  });

  it("filters disabled locales from a platform list", () => {
    const platform = ["en", "fr", "de"];
    const offered = (["en", "fr", "de", "it", "ar"] as const).filter((c) =>
      platform.includes(c)
    );
    expect(offered).toEqual(["en", "fr", "de"]);
    expect(offered.includes("ar")).toBe(false);
    expect(offered.includes("it")).toBe(false);
  });
});
