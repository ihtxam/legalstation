/**
 * Visibility rules for platform announcements.
 *
 * An announcement targets the people who were on the platform when it was
 * published: accounts created after `startsAt` never see it (a brand-new firm
 * admin should not be greeted by "critical" notices that predate their signup).
 */
export function isAnnouncementVisibleTo(
  announcement: { audience: string; startsAt: Date },
  viewer: { firmRole: string; accountCreatedAt: Date | null }
): boolean {
  const isAdmin = ["admin", "subadmin"].includes(viewer.firmRole);
  if (announcement.audience !== "all_members" && !isAdmin) return false;

  // Only accounts that existed when the announcement went live.
  if (viewer.accountCreatedAt && viewer.accountCreatedAt > announcement.startsAt) {
    return false;
  }
  return true;
}
