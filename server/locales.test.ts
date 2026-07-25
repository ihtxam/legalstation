import { describe, expect, it } from "vitest";
import { APP_LOCALES, isAppLocale, isRtlLocale } from "../shared/locales";

describe("app locales", () => {
  it("includes EN FR DE IT AR", () => {
    expect(APP_LOCALES).toEqual(["en", "fr", "de", "it", "ar"]);
  });

  it("treats Arabic as RTL", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });

  it("validates locale codes", () => {
    expect(isAppLocale("it")).toBe(true);
    expect(isAppLocale("es")).toBe(false);
  });
});
