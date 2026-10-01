export function asPhotos(photos: unknown): string[] {
  if (Array.isArray(photos)) return photos.filter((p): p is string => typeof p === "string" && p.length > 0);
  if (typeof photos === "string") {
    try {
      const parsed = JSON.parse(photos);
      return asPhotos(parsed);
    } catch {
      return photos.startsWith("http") ? [photos] : [];
    }
  }
  return [];
}

export function asTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
  if (typeof tags === "string") {
    try {
      return asTags(JSON.parse(tags));
    } catch {
      return [];
    }
  }
  return [];
}

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function previewText(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}
