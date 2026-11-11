/** Проверяет обязательный секрет сессий до приёма production-запросов. */
import { ENV } from "./env";

/** Отказ до приёма production-запросов; значение секрета не попадает в ошибку. */
export function validateSessionConfiguration() {
  if (ENV.isProduction && Buffer.byteLength(ENV.cookieSecret, "utf8") < 32)
    throw new Error("JWT_SECRET must contain at least 32 bytes in production");
}
