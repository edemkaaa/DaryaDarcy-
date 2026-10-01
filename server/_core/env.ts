function env(name: string, fallback = "") {
  return (process.env[name] ?? fallback).replace(/\r/g, "").trim();
}

export const ENV = {
  get appId() {
    return env("VITE_APP_ID") || env("APP_ID", "daryadarcy");
  },
  get cookieSecret() {
    return env("JWT_SECRET");
  },
  get databaseUrl() {
    return env("DATABASE_URL");
  },
  get oAuthServerUrl() {
    return env("OAUTH_SERVER_URL");
  },
  get ownerOpenId() {
    return env("OWNER_OPEN_ID");
  },
  get ownerEmail() {
    return env("OWNER_EMAIL").toLowerCase();
  },
  get publicAppUrl() {
    return env("PUBLIC_APP_URL").replace(/\/$/, "");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return env("BUILT_IN_FORGE_API_URL");
  },
  get forgeApiKey() {
    return env("BUILT_IN_FORGE_API_KEY");
  },
  get s3Endpoint() {
    return env("S3_ENDPOINT");
  },
  get s3AccessKey() {
    return env("S3_ACCESS_KEY");
  },
  get s3SecretKey() {
    return env("S3_SECRET_KEY");
  },
  get s3Bucket() {
    return env("S3_BUCKET");
  },
  get smsRuApiId() {
    return env("SMS_RU_API_ID");
  },
  get smsRuFrom() {
    return env("SMS_RU_FROM", "daryadarcy");
  },
};
