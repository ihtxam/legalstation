/**
 * LexFlow firm role model (default permissions).
 *
 * Platform roles (users.role): user | admin | superadmin — separate from firm roles.
 * Clients are not firmMembers; they access the client portal via clients.userId.
 *
 * | Capability                         | admin | subadmin | lawyer | assistant | client |
 * |------------------------------------|:-----:|:--------:|:------:|:---------:|:------:|
 * | Firm settings / upload policy      |  ✓    |    ✓     |   —    |     —     |   —    |
 * | Invite staff (incl. subadmin*)     |  ✓    |    ✓*    |   —    |     —     |   —    |
 * | Invite clients                     |  ✓    |    ✓     |   ✓    |     —     |   —    |
 * | CMS / analytics / audit            |  ✓    |    ✓     |   —    |     —     |   —    |
 * | All firm cases                     |  ✓    |    ✓     |   —    |     —     |   —    |
 * | Own assigned cases only            |  ✓    |    ✓     |   ✓    |     ✓     | assigned|
 * | All firm invoices                  |  ✓    |    ✓     |   —    |     —     |   —    |
 * | Invoices on own cases              |  ✓    |    ✓     |   ✓    |  view**   | own*** |
 * | Create / edit invoices             |  ✓    |    ✓     |   ✓    |     —     |   —    |
 * | Security / language settings       |  ✓    |    ✓     |   ✓    |     ✓     |   ✓    |
 *
 * * Subadmin may invite lawyer/assistant/client, not another admin.
 * ** Assistant can view invoices for assigned cases; cannot create/edit.
 * *** Client sees own non-draft invoices only. Never platform-wide invoices.
 */

export const FIRM_STAFF_ROLES = ["admin", "subadmin", "lawyer", "assistant"] as const;
export type FirmStaffRole = (typeof FIRM_STAFF_ROLES)[number];

export const INVITE_ROLES = ["subadmin", "lawyer", "assistant", "client"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

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
