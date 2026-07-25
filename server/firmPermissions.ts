import {
  flagsForRole,
  mergeRoleCapabilityMatrix,
  parseRoleCapabilityOverrides,
  type RoleCapabilityOverrides,
  type RoleCapabilityRow,
} from "@shared/roles";
import { getFirmById } from "./db";

export async function getFirmCapabilityMatrix(firmId: number): Promise<{
  matrix: RoleCapabilityRow[];
  overrides: RoleCapabilityOverrides | null;
  hasOverrides: boolean;
}> {
  const firm = await getFirmById(firmId);
  const overrides = parseRoleCapabilityOverrides(firm?.roleCapabilityOverrides);
  const matrix = mergeRoleCapabilityMatrix(overrides);
  return {
    matrix,
    overrides,
    hasOverrides: Boolean(overrides && Object.keys(overrides).length),
  };
}

export async function getMemberCapabilityFlags(firmId: number, role: string | null | undefined) {
  const { matrix, hasOverrides } = await getFirmCapabilityMatrix(firmId);
  return { ...flagsForRole(matrix, role), hasOverrides, matrix };
}
