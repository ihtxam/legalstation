/**
 * Cliavo firm role model.
 *
 * Platform roles (users.role): user | admin | superadmin — separate from firm roles.
 * Clients are not firmMembers; they access the client portal via clients.userId.
 *
 * Defaults live in ROLE_CAPABILITY_MATRIX. Firms may override per-capability access
 * in firms.roleCapabilityOverrides (JSON). Admin role always keeps firmSettings=full.
 */

export const FIRM_STAFF_ROLES = ["admin", "subadmin", "lawyer", "assistant"] as const;
export type FirmStaffRole = (typeof FIRM_STAFF_ROLES)[number];

export const FIRM_DISPLAY_ROLES = ["admin", "subadmin", "lawyer", "assistant", "client"] as const;
export type FirmDisplayRole = (typeof FIRM_DISPLAY_ROLES)[number];

export const INVITE_ROLES = ["subadmin", "lawyer", "assistant", "client"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const CAPABILITY_ACCESS_LEVELS = ["none", "view", "own", "full"] as const;
export type CapabilityAccess = (typeof CAPABILITY_ACCESS_LEVELS)[number];

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

export const ROLE_CAPABILITY_IDS: RoleCapabilityId[] = [
  "firmSettings",
  "inviteStaff",
  "inviteClients",
  "cmsAnalyticsAudit",
  "allCases",
  "assignedCases",
  "allInvoices",
  "caseInvoices",
  "createEditInvoices",
  "securityLanguage",
];

export type RoleCapabilityRow = {
  id: RoleCapabilityId;
  /** i18n key under roles.capabilities.* */
  labelKey: string;
  access: Record<FirmDisplayRole, CapabilityAccess>;
  noteKey?: string;
};

/** Partial overrides: capability → role → access */
export type RoleCapabilityOverrides = Partial<
  Record<RoleCapabilityId, Partial<Record<FirmDisplayRole, CapabilityAccess>>>
>;

/**
 * Default authorization matrix (roles × functions).
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

const ACCESS_RANK: Record<CapabilityAccess, number> = {
  none: 0,
  view: 1,
  own: 2,
  full: 3,
};

export function isCapabilityAccess(value: unknown): value is CapabilityAccess {
  return typeof value === "string" && (CAPABILITY_ACCESS_LEVELS as readonly string[]).includes(value);
}

export function isFirmDisplayRole(value: unknown): value is FirmDisplayRole {
  return typeof value === "string" && (FIRM_DISPLAY_ROLES as readonly string[]).includes(value);
}

export function isRoleCapabilityId(value: unknown): value is RoleCapabilityId {
  return typeof value === "string" && (ROLE_CAPABILITY_IDS as readonly string[]).includes(value);
}

export function parseRoleCapabilityOverrides(raw: unknown): RoleCapabilityOverrides | null {
  if (raw == null || raw === "") return null;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;

  const out: RoleCapabilityOverrides = {};
  for (const [cap, roleMap] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isRoleCapabilityId(cap) || !roleMap || typeof roleMap !== "object") continue;
    const row: Partial<Record<FirmDisplayRole, CapabilityAccess>> = {};
    for (const [role, access] of Object.entries(roleMap as Record<string, unknown>)) {
      if (isFirmDisplayRole(role) && isCapabilityAccess(access)) {
        row[role] = access;
      }
    }
    if (Object.keys(row).length) out[cap] = row;
  }
  return Object.keys(out).length ? out : null;
}

/** Merge defaults with firm overrides. Admin always keeps firmSettings=full. */
export function mergeRoleCapabilityMatrix(
  overrides?: RoleCapabilityOverrides | null
): RoleCapabilityRow[] {
  return ROLE_CAPABILITY_MATRIX.map((row) => {
    const overrideRow = overrides?.[row.id];
    const access = { ...row.access };
    if (overrideRow) {
      for (const role of FIRM_DISPLAY_ROLES) {
        const v = overrideRow[role];
        if (isCapabilityAccess(v)) access[role] = v;
      }
    }
    if (row.id === "firmSettings") {
      access.admin = "full";
    }
    return { ...row, access };
  });
}

/** Build overrides object from a full matrix (only cells that differ from defaults). */
export function diffRoleCapabilityOverrides(matrix: RoleCapabilityRow[]): RoleCapabilityOverrides {
  const defaults = new Map(ROLE_CAPABILITY_MATRIX.map((r) => [r.id, r]));
  const out: RoleCapabilityOverrides = {};
  for (const row of matrix) {
    const base = defaults.get(row.id);
    if (!base) continue;
    const diff: Partial<Record<FirmDisplayRole, CapabilityAccess>> = {};
    for (const role of FIRM_DISPLAY_ROLES) {
      // Never persist demotion of admin firmSettings
      if (row.id === "firmSettings" && role === "admin") continue;
      if (row.access[role] !== base.access[role]) {
        diff[role] = row.access[role];
      }
    }
    if (Object.keys(diff).length) out[row.id] = diff;
  }
  return out;
}

export function getCapabilityAccess(
  matrix: RoleCapabilityRow[],
  capabilityId: RoleCapabilityId,
  role: string | null | undefined
): CapabilityAccess {
  if (!role || !isFirmDisplayRole(role)) return "none";
  const row = matrix.find((r) => r.id === capabilityId);
  return row?.access[role] ?? "none";
}

export function roleHasAccess(
  matrix: RoleCapabilityRow[],
  role: string | null | undefined,
  capabilityId: RoleCapabilityId,
  minAccess: CapabilityAccess = "full"
): boolean {
  const access = getCapabilityAccess(matrix, capabilityId, role);
  return ACCESS_RANK[access] >= ACCESS_RANK[minAccess];
}

export function flagsForRole(
  matrix: RoleCapabilityRow[],
  role: string | null | undefined
): Record<RoleCapabilityId, CapabilityAccess> & {
  canManageFirmSettings: boolean;
  canInviteStaff: boolean;
  canInviteClients: boolean;
  canAccessAdminConsole: boolean;
  canSeeFirmWideCases: boolean;
  canSeeFirmWideInvoices: boolean;
  canCreateInvoice: boolean;
} {
  const access = Object.fromEntries(
    ROLE_CAPABILITY_IDS.map((id) => [id, getCapabilityAccess(matrix, id, role)])
  ) as Record<RoleCapabilityId, CapabilityAccess>;

  return {
    ...access,
    canManageFirmSettings: roleHasAccess(matrix, role, "firmSettings", "full"),
    canInviteStaff: roleHasAccess(matrix, role, "inviteStaff", "full"),
    canInviteClients: roleHasAccess(matrix, role, "inviteClients", "full"),
    canAccessAdminConsole: roleHasAccess(matrix, role, "cmsAnalyticsAudit", "full"),
    canSeeFirmWideCases: roleHasAccess(matrix, role, "allCases", "full"),
    canSeeFirmWideInvoices: roleHasAccess(matrix, role, "allInvoices", "full"),
    canCreateInvoice: roleHasAccess(matrix, role, "createEditInvoices", "full"),
  };
}

/** Sync helpers using default matrix (client fallback / tests). Prefer matrix-aware calls. */
export function isFirmAdminLike(role: string | null | undefined): boolean {
  return role === "admin" || role === "subadmin";
}

export function canManageFirmSettings(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "firmSettings", "full");
}

export function canInviteStaff(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "inviteStaff", "full");
}

export function canInviteClient(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "inviteClients", "full");
}

export function canSeeFirmWideCases(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "allCases", "full");
}

export function canSeeFirmWideInvoices(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "allInvoices", "full");
}

export function canCreateInvoice(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "createEditInvoices", "full");
}

export function canAccessAdminConsole(
  role: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): boolean {
  return roleHasAccess(matrix, role, "cmsAnalyticsAudit", "full");
}

/** Who may invite which roles (admin invite of subadmin stays owner-admin only). */
export function getInvitableRoles(
  actorRole: string | null | undefined,
  matrix: RoleCapabilityRow[] = ROLE_CAPABILITY_MATRIX
): InviteRole[] {
  const roles: InviteRole[] = [];
  if (canInviteStaff(actorRole, matrix)) {
    if (actorRole === "admin") roles.push("subadmin");
    roles.push("lawyer", "assistant");
  }
  if (canInviteClient(actorRole, matrix)) {
    roles.push("client");
  }
  return roles;
}
