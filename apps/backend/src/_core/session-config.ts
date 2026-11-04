import { ENV } from "./env";

/** Fail before accepting production requests; never include the key in errors. */
export function validateSessionConfiguration() {
  if (ENV.isProduction && Buffer.byteLength(ENV.cookieSecret, "utf8") < 32)
    throw new Error("JWT_SECRET must contain at least 32 bytes in production");
}
