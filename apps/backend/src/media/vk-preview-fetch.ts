/** Чтение обложек VK ограничено разрешёнными источниками, размером и временем запроса. */
/** The isolated API may use its private, fixed-host egress gateway. Browser
 * cookies, auth headers and redirects never cross this provider boundary. */
/** Запрашиваем только фиксированный VK-плеер и разрешённые изображения без cookies и редиректов; необязательный внутренний gateway имеет единственный жёстко проверенный origin. */
export function fetchVkPreview(
  url: string,
  signal: AbortSignal,
  transport: typeof fetch = fetch,
) {
  const target = new URL(url);
  const player =
    target.hostname === "vk.com" && target.pathname === "/video_ext.php";
  const image =
    (/^(?:[a-z0-9-]+\.)*userapi\.com$/.test(target.hostname) &&
      /\.(?:jpe?g|png|webp|avif)$/i.test(target.pathname)) ||
    (target.hostname === "iv.okcdn.ru" &&
      target.pathname === "/getVideoPreview");
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.port ||
    target.hash ||
    (!player && !image)
  )
    throw new Error("Unsupported VK preview resource");
  const configured = process.env.VK_PREVIEW_PROXY_URL?.trim();
  const options: RequestInit = {
    redirect: "error",
    credentials: "omit",
    signal,
  };
  if (!configured) return transport(target.href, options);
  const gateway = new URL(configured);
  if (
    gateway.origin !== "http://s3-egress:8081" ||
    gateway.username ||
    gateway.password ||
    gateway.pathname !== "/" ||
    gateway.search ||
    gateway.hash
  )
    throw new Error("Invalid VK preview gateway");
  const path = player ? "/player" : "/image" + target.pathname;
  return transport(gateway.origin + path + target.search, {
    ...options,
    headers: image ? { "X-VK-Preview-Host": target.hostname } : {},
  });
}
