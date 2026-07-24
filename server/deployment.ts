import { ENV } from "./_core/env";

export type DeploymentMode = "saas" | "on_premise";

function rawDeploymentMode(): string {
  return (process.env.DEPLOYMENT_MODE ?? ENV.deploymentMode ?? "saas").toLowerCase().trim();
}

export function getDeploymentMode(): DeploymentMode {
  const raw = rawDeploymentMode();
  return raw === "on_premise" || raw === "on-premise" || raw === "onprem"
    ? "on_premise"
    : "saas";
}

export function isOnPremise(): boolean {
  return getDeploymentMode() === "on_premise";
}

export function isSaas(): boolean {
  return getDeploymentMode() === "saas";
}

/** On-prem installs are single-tenant: only one firm workspace is allowed. */
export function isSingleTenant(): boolean {
  if (isOnPremise()) return true;
  const single =
    process.env.SINGLE_TENANT != null
      ? ["1", "true", "yes", "on"].includes(process.env.SINGLE_TENANT.toLowerCase())
      : ENV.singleTenant;
  return single;
}

export function getEncryptionConfig() {
  return {
    dbEncryptionAtRest:
      process.env.DB_ENCRYPTION_AT_REST != null
        ? ["1", "true", "yes", "on"].includes(process.env.DB_ENCRYPTION_AT_REST.toLowerCase())
        : ENV.dbEncryptionAtRest,
    s3Sse: process.env.S3_SSE_MODE || ENV.s3SseMode || "AES256",
    s3KmsKeyId: process.env.S3_KMS_KEY_ID || ENV.s3KmsKeyId || "",
    tenantDekEnabled:
      process.env.TENANT_DEK_ENABLED != null
        ? ["1", "true", "yes", "on"].includes(process.env.TENANT_DEK_ENABLED.toLowerCase())
        : ENV.tenantDekEnabled,
  };
}

export function deploymentPublicInfo() {
  return {
    mode: getDeploymentMode(),
    singleTenant: isSingleTenant(),
    encryption: getEncryptionConfig(),
    dataResidency: process.env.DATA_RESIDENCY || ENV.dataResidency || "CH",
  };
}
