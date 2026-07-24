export type DeploymentMode = "saas" | "on_premise";
export type StorageBackend = "forge" | "s3" | "local";

function asBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const deploymentMode = (process.env.DEPLOYMENT_MODE ?? "saas") as DeploymentMode;
const storageBackend = (process.env.STORAGE_BACKEND ??
  (process.env.BUILT_IN_FORGE_API_URL ? "forge" : "local")) as StorageBackend;

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  deploymentMode,
  storageBackend,
  enableDevLogin: asBool(process.env.ENABLE_DEV_LOGIN, !process.env.OAUTH_SERVER_URL),
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "lexflow",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: asBool(process.env.S3_FORCE_PATH_STYLE, true),
    publicUrl: process.env.S3_PUBLIC_URL ?? "",
  },
  localUploadDir: process.env.LOCAL_UPLOAD_DIR ?? "uploads",
};
