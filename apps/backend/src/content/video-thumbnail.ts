/** Only existing public image namespaces; never advertise private/signed media
 * or a player URL as a cover. This function does not fetch external content. */
export function publicCatalogThumbnail(raw: string | null) {
  if (!raw || raw.length > 2048) return null;
  const value = raw.trim();
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
      /^\/daryadarcy-s3\/(?:feed|app-assets)\/[\w/.-]+\.(?:webp|png|jpe?g|avif)$/i.test(
        url.pathname,
      )
    )
      return url.toString();
  } catch {}
  return null;
}
