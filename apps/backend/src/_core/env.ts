/** Собирает параметры окружения в совместимый объект настроек; секреты остаются вне исходников. */
function env(name: string, fallback = "") {
  return (process.env[name] ?? fallback).replace(/\r/g, "").trim();
}

export const ENV = {
  /** Читает идентификатор приложения при обращении: VITE_APP_ID имеет приоритет над APP_ID. */
  get appId() {
    return env("VITE_APP_ID") || env("APP_ID", "daryadarcy");
  },
  /** Возвращает текущий JWT_SECRET без копирования в публичные настройки. */
  get cookieSecret() {
    return env("JWT_SECRET");
  },
  /** Получает строку подключения MySQL из окружения при обращении к getter. */
  get databaseUrl() {
    return env("DATABASE_URL");
  },
  /** Возвращает origin legacy OAuth-сервиса, если интеграция настроена. */
  get oAuthServerUrl() {
    return env("OAUTH_SERVER_URL");
  },
  /** Читает заданный оператором openId владельца для совместимых вызовов. */
  get ownerOpenId() {
    return env("OWNER_OPEN_ID");
  },
  /** Нормализует настроенный email владельца к нижнему регистру. */
  get ownerEmail() {
    return env("OWNER_EMAIL").toLowerCase();
  },
  /** Удаляет завершающий slash у публичного адреса приложения из конфигурации. */
  get publicAppUrl() {
    return env("PUBLIC_APP_URL").replace(/\/$/, "");
  },
  /** Считает production только точное значение NODE_ENV=production. */
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** Читает адрес существующего служебного API уведомлений. */
  get forgeApiUrl() {
    return env("BUILT_IN_FORGE_API_URL");
  },
  /** Возвращает секрет служебного API только серверным потребителям. */
  get forgeApiKey() {
    return env("BUILT_IN_FORGE_API_KEY");
  },
  /** Читает настроенную точку S3, не подставляя origin входящего запроса. */
  get s3Endpoint() {
    return env("S3_ENDPOINT");
  },
  /** Получает идентификатор ключа S3 для серверного клиента. */
  get s3AccessKey() {
    return env("S3_ACCESS_KEY");
  },
  /** Получает секрет ключа S3 для серверной подписи запросов. */
  get s3SecretKey() {
    return env("S3_SECRET_KEY");
  },
  /** Возвращает имя настроенного бакета S3 без чтения его содержимого. */
  get s3Bucket() {
    return env("S3_BUCKET");
  },
  /** Возвращает ключ SMS.ru только серверному адаптеру отправки. */
  get smsRuApiId() {
    return env("SMS_RU_API_ID");
  },
  /** Использует настроенное имя SMS-отправителя либо совместимое значение daryadarcy. */
  get smsRuFrom() {
    return env("SMS_RU_FROM", "daryadarcy");
  },
};
