// Архив Expo. Отбрасывает нестроковые и небезопасные схемы/учётные данные, сохраняя порядок HTTP(S) картинок.
/** Ignore malformed API photo values without changing valid URL order. */
export function sanitizePhotoUrls(value: unknown): string[] {
  // Отбрасывает нестроковые и небезопасные схемы/учётные данные, сохраняя порядок HTTP(S) картинок.

  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => {
    if (typeof url !== "string" || !url.trim()) return false;
    try {
      const parsed = new URL(url);
      // API media is served from S3/CDN. Do not accept executable/local schemes.
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  });
}
