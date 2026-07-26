import { describe, expect, it } from "vitest";
import { isAnnouncementVisibleTo } from "./announcementVisibility";

const publishedAt = new Date("2026-07-01T12:00:00Z");
const before = new Date("2026-06-01T00:00:00Z");
const after = new Date("2026-07-20T00:00:00Z");

describe("announcement visibility", () => {
  it("shows admin-audience announcements to existing admins", () => {
    expect(
      isAnnouncementVisibleTo(
        { audience: "firm_admins", startsAt: publishedAt },
        { firmRole: "admin", accountCreatedAt: before }
      )
    ).toBe(true);
  });

  it("hides announcements from accounts created after publication", () => {
    expect(
      isAnnouncementVisibleTo(
        { audience: "firm_admins", startsAt: publishedAt },
        { firmRole: "admin", accountCreatedAt: after }
      )
    ).toBe(false);
    expect(
      isAnnouncementVisibleTo(
        { audience: "all_members", startsAt: publishedAt },
        { firmRole: "lawyer", accountCreatedAt: after }
      )
    ).toBe(false);
  });

  it("respects the admin-only audience", () => {
    expect(
      isAnnouncementVisibleTo(
        { audience: "firm_admins", startsAt: publishedAt },
        { firmRole: "lawyer", accountCreatedAt: before }
      )
    ).toBe(false);
    expect(
      isAnnouncementVisibleTo(
        { audience: "all_members", startsAt: publishedAt },
        { firmRole: "assistant", accountCreatedAt: before }
      )
    ).toBe(true);
  });

  it("subadmins count as admins", () => {
    expect(
      isAnnouncementVisibleTo(
        { audience: "firm_admins", startsAt: publishedAt },
        { firmRole: "subadmin", accountCreatedAt: before }
      )
    ).toBe(true);
  });

  it("shows announcements when account age is unknown", () => {
    expect(
      isAnnouncementVisibleTo(
        { audience: "firm_admins", startsAt: publishedAt },
        { firmRole: "admin", accountCreatedAt: null }
      )
    ).toBe(true);
  });
});
