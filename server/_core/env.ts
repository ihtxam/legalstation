function boolEnv(value: string | undefined, defaultValue = false): boolean {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

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
  /** Verified Brevo sender address (must match a sender in the Brevo account) */
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "Cliavo",

  /** Canonical public URL for emails / redirects (e.g. https://cliavo.com) */
  appUrl: process.env.APP_URL ?? "",
  /** Apex domain for firm subdomains (e.g. cliavo.com → firm.cliavo.com) */
  appBaseDomain: process.env.APP_BASE_DOMAIN ?? "",
  /** One-time secret to bootstrap the first platform superadmin via /api/auth/bootstrap-superadmin */
  superadminBootstrapSecret: process.env.SUPERADMIN_BOOTSTRAP_SECRET ?? "",

  /** Passwordless demo login + seed (dev/demo hosts only by default) */
  demoAuthEnabled: boolEnv(process.env.DEMO_AUTH_ENABLED),
  demoAuthAllowProduction: boolEnv(process.env.DEMO_AUTH_ALLOW_PRODUCTION),

  /** saas | on_premise */
  deploymentMode: process.env.DEPLOYMENT_MODE ?? "saas",
  /** Force single-tenant even in saas (rare) */
  singleTenant: boolEnv(process.env.SINGLE_TENANT),
  /** ISO country / region code for data residency claims (default CH) */
  dataResidency: process.env.DATA_RESIDENCY ?? "CH",

  /** On-prem offline license */
  licenseKey: process.env.LICENSE_KEY ?? "",
  licenseSigningSecret: process.env.LICENSE_SIGNING_SECRET ?? "",
  licenseGraceDays: Number(process.env.LICENSE_GRACE_DAYS || 14),

  /** Encryption configuration (operational; actual crypto is infra-level) */
  dbEncryptionAtRest: boolEnv(process.env.DB_ENCRYPTION_AT_REST),
  s3SseMode: process.env.S3_SSE_MODE ?? "AES256",
  s3KmsKeyId: process.env.S3_KMS_KEY_ID ?? "",
  tenantDekEnabled: boolEnv(process.env.TENANT_DEK_ENABLED),
  /** Base64 KEK used to wrap per-tenant DEKs when enabled */
  tenantKek: process.env.TENANT_KEK ?? "",

  /** Google Calendar OAuth (optional) */
  googleCalendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
  googleCalendarClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",

  /** Microsoft / Outlook Calendar OAuth (optional) */
  microsoftCalendarClientId: process.env.MICROSOFT_CALENDAR_CLIENT_ID ?? "",
  microsoftCalendarClientSecret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET ?? "",
  microsoftCalendarTenant: process.env.MICROSOFT_CALENDAR_TENANT ?? "common",
};
