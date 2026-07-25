/**
 * LexFlow firm role model (default permissions).
 *
 * Platform roles (users.role): user | admin | superadmin — separate from firm roles.
 * Clients are not firmMembers; they access the client portal via clients.userId.
 *
 * Admins create users by inviting them into one of these fixed roles.
 * Custom role definitions are not supported yet — permissions below are the defaults.
 */

export const FIRM_STAFF_ROLES = ["admin", "subadmin", "lawyer", "assistant"] as const;
export type FirmStaffRole = (typeof FIRM_STAFF_ROLES)[number];

export const FIRM_DISPLAY_ROLES = ["admin", "subadmin", "lawyer", "assistant", "client"] as const;
export type FirmDisplayRole = (typeof FIRM_DISPLAY_ROLES)[number];

export const INVITE_ROLES = ["subadmin", "lawyer", "assistant", "client"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Access level shown in the authorization matrix UI. */
export type CapabilityAccess = "full" | "own" | "view" | "none";

export type RoleCapabilityId =
  | "firmSettings"
  | "inviteStaff"
  | "inviteClients"
  | "cmsAnalyticsAudit"
  | "allCases"
  | "assignedCases"
  | "allInvoices"
  | "caseInvoices"
  | "createEditInvoices"
  | "securityLanguage";

export type RoleCapabilityRow = {
  id: RoleCapabilityId;
  /** i18n key under roles.capabilities.* */
  labelKey: string;
  access: Record<FirmDisplayRole, CapabilityAccess>;
  noteKey?: string;
};

/**
 * Canonical authorization matrix (roles × functions).
 * Used by the Settings → Roles table and kept in sync with server checks.
 */
export const ROLE_CAPABILITY_MATRIX: RoleCapabilityRow[] = [
  {
    id: "firmSettings",
    labelKey: "roles.capabilities.firmSettings",
    access: { admin: "full", subadmin: "full", lawyer: "none", assistant: "none", client: "none" },
  },
  {
    id: "inviteStaff",
    labelKey: "roles.capabilities.inviteStaff",
    access: { admin: "full", subadmin: "full", lawyer: "none", assistant: "none", client: "none" },
    noteKey: "roles.notes.inviteStaff",
  },
  {
    id: "inviteClients",
    labelKey: "roles.capabilities.inviteClients",
    access: { admin: "full", subadmin: "full", lawyer: "full", assistant: "none", client: "none" },
  },
  {
    id: "cmsAnalyticsAudit",
    labelKey: "roles.capabilities.cmsAnalyticsAudit",
    access: { admin: "full", subadmin: "full", lawyer: "none", assistant: "none", client: "none" },
  },
  {
    id: "allCases",
    labelKey: "roles.capabilities.allCases",
    access: { admin: "full", subadmin: "full", lawyer: "none", assistant: "none", client: "none" },
  },
  {
    id: "assignedCases",
    labelKey: "roles.capabilities.assignedCases",
    access: { admin: "full", subadmin: "full", lawyer: "own", assistant: "own", client: "own" },
  },
  {
    id: "allInvoices",
    labelKey: "roles.capabilities.allInvoices",
    access: { admin: "full", subadmin: "full", lawyer: "none", assistant: "none", client: "none" },
  },
  {
    id: "caseInvoices",
    labelKey: "roles.capabilities.caseInvoices",
    access: { admin: "full", subadmin: "full", lawyer: "own", assistant: "view", client: "view" },
    noteKey: "roles.notes.caseInvoices",
  },
  {
    id: "createEditInvoices",
    labelKey: "roles.capabilities.createEditInvoices",
    access: { admin: "full", subadmin: "full", lawyer: "full", assistant: "none", client: "none" },
  },
  {
    id: "securityLanguage",
    labelKey: "roles.capabilities.securityLanguage",
    access: { admin: "full", subadmin: "full", lawyer: "full", assistant: "full", client: "full" },
  },
];

export function isFirmAdminLike(role: string | null | undefined): boolean {
  return role === "admin" || role === "subadmin";
}

export function canManageFirmSettings(role: string | null | undefined): boolean {
  return isFirmAdminLike(role);
}

export function canInviteStaff(role: string | null | undefined): boolean {
  return isFirmAdminLike(role);
}

export function canInviteClient(role: string | null | undefined): boolean {
  return isFirmAdminLike(role) || role === "lawyer";
}

export function canSeeFirmWideCases(role: string | null | undefined): boolean {
  return isFirmAdminLike(role);
}

export function canSeeFirmWideInvoices(role: string | null | undefined): boolean {
  return isFirmAdminLike(role);
}

export function canCreateInvoice(role: string | null | undefined): boolean {
  return isFirmAdminLike(role) || role === "lawyer";
}

export function canAccessAdminConsole(role: string | null | undefined): boolean {
  return isFirmAdminLike(role);
}

/** Who may invite which roles. */
export function getInvitableRoles(actorRole: string | null | undefined): InviteRole[] {
  if (actorRole === "admin") return ["subadmin", "lawyer", "assistant", "client"];
  if (actorRole === "subadmin") return ["lawyer", "assistant", "client"];
  if (actorRole === "lawyer") return ["client"];
  return [];
}
