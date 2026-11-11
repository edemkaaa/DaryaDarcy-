/** Строит публичные ссылки только из доверенной настройки оператора, а не Host/Origin клиента. */
/** Публичную навигацию задаёт оператор, а не заголовки Host/Origin запроса. */
export function publicAccessUrl(token?: string): URL {
  const configured = process.env.PUBLIC_APP_URL || "";
  let base: URL;
  try {
    base = new URL(configured.replace(/\r/g, "").trim());
  } catch {
    throw new Error("Invalid public access URL");
  }
  const localHttp =
    process.env.NODE_ENV !== "production" &&
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    (base.protocol !== "https:" && !localHttp)
  ) {
    throw new Error("Invalid public access URL");
  }
  const url = new URL(token ? "/password" : "/login", base.origin);
  if (token) url.hash = `token=${token}`;
  return url;
}
