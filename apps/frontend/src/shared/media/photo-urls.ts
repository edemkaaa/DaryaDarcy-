"use client";
/** Ignore malformed API photo values without changing valid URL order. */
export function sanitizePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => {
    if (typeof url !== "string" || !url.trim()) return false;
    // New uploads use a canonical same-origin read URL; retain it verbatim.
    if (
      /^\/api\/media\/content-files\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        url,
      )
    )
      return true;
    try {
      const parsed = new URL(url);
      // API media is served from S3/CDN. Do not accept executable/local schemes.
      return (
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  });
}
