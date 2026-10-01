const RAW_NAME =
  /^(img|dsc|vid|mov|pxl|screenshot|photo|video)[-_\s]?\d/i;

export function isRawMediaFilename(name?: string | null): boolean {
  if (!name) return true;
  const base = name.trim().split(/[\\/]/).pop() || "";
  if (!base) return true;
  if (RAW_NAME.test(base)) return true;
  if (/^img[-_]?\d+/i.test(base)) return true;
  return false;
}

export function friendlyMediaName(
  filename: string | null | undefined,
  type: "video" | "audio" | "document",
): string | null {
  const fallback = type === "video" ? "Видео" : type === "audio" ? "Аудио" : "Документ";
  if (!filename || isRawMediaFilename(filename)) return type === "video" ? null : fallback;
  const base = filename.trim().split(/[\\/]/).pop() || fallback;
  return base.replace(/\.[a-z0-9]{2,4}$/i, "") || fallback;
}

export function displayPostTitle(text?: string | null): string {
  const lines = (text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] || "";
  if (!first || isRawMediaFilename(first)) {
    const next = lines.slice(1).find((line) => !isRawMediaFilename(line));
    return next ? next.slice(0, 80) : "Запись клуба";
  }
  return first.slice(0, 80);
}
