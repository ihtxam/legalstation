import { describe, expect, it } from "vitest";
import {
  diffRoleCapabilityOverrides,
  mergeRoleCapabilityMatrix,
  roleHasAccess,
  ROLE_CAPABILITY_MATRIX,
} from "@shared/roles";

describe("role capability overrides", () => {
  it("merges overrides and locks admin firmSettings", () => {
    const matrix = mergeRoleCapabilityMatrix({
      firmSettings: { admin: "none", lawyer: "full" },
      createEditInvoices: { assistant: "full" },
    });
    expect(roleHasAccess(matrix, "admin", "firmSettings", "full")).toBe(true);
    expect(roleHasAccess(matrix, "lawyer", "firmSettings", "full")).toBe(true);
    expect(roleHasAccess(matrix, "assistant", "createEditInvoices", "full")).toBe(true);
  });

  it("diffs only changed cells", () => {
    const next = ROLE_CAPABILITY_MATRIX.map((r) =>
      r.id === "inviteClients"
        ? { ...r, access: { ...r.access, assistant: "full" as const } }
        : { ...r, access: { ...r.access } }
    );
    const diff = diffRoleCapabilityOverrides(next);
    expect(diff).toEqual({ inviteClients: { assistant: "full" } });
  });
});
