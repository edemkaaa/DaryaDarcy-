/** Каталог принимает только точные публичные пути обложек; подписанные и закрытые адреса не рекламируются клиенту. */
/** Only existing public image namespaces; never advertise private/signed media
 * or a player URL as a cover. This function does not fetch external content. */
export function publicCatalogThumbnail(raw: string | null) {
  if (!raw || raw.length > 2048) return null;
  const value = raw.trim();
  // Проверяем исходную строку до URL-нормализации, скрывающей обход каталогов.
  if (
    /[\u0000-\u0020\u007f\\%]/.test(value) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)
  )
    return null;
  if (/^\/assets\/responsive\/[\w.-]+\.(?:webp|png|jpe?g|avif)$/i.test(value))
    return value;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "s3.twcstorage.ru" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (/^\/daryadarcy-s3\/(?:feed|app-assets)\/[\w/.-]+\.(?:webp|png|jpe?g|avif)$/i.test(
        url.pathname,
      ) ||
        /^\/daryadarcy-s3\/covers\/(?:public-v1\/)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/i.test(
          url.pathname,
        ) ||
        /^\/daryadarcy-s3\/covers\/vk-v1\/[a-f0-9]{64}\/[a-f0-9]{64}\.webp$/i.test(
          url.pathname,
        ))
    )
      return url.toString();
  } catch {}
  return null;
}
