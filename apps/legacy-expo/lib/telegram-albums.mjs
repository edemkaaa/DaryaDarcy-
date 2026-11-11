// Архив Expo. Склеивает строку или Telegram entities и убирает краевые пробелы.
/**
 * Telegram albums export as several messages with the same date_unixtime:
 * one carries text, siblings are photo-only.
 */

export function plainText(msg) {
  // Склеивает строку или Telegram entities и убирает краевые пробелы.

  if (typeof msg.text === "string") return msg.text.trim();
  if (!Array.isArray(msg.text)) return "";
  return msg.text.map((part) => (typeof part === "string" ? part : part.text || "")).join("").trim();
}

export function isPhotoOnlyMessage(msg) {
  // Распознаёт фото без файлового вложения и подписи.

  if (!msg?.photo || msg.file) return false;
  return plainText(msg).length === 0;
}

export function hasAlbumText(msg) {
  // Отличает сообщение с подписью от остальных кадров альбома.

  return plainText(msg).length > 0;
}

/** Group messages sharing the same unix timestamp (TG album burst). */
export function buildAlbumGroups(messages) {
  // Группирует фото по Unix-времени, выбирает подпись якорем и отмечает поглощённые соседние сообщения.

  const byTime = new Map();
  for (const msg of messages) {
    if (msg.type !== "message" || !msg.photo) continue;
    const key = String(msg.date_unixtime || "");
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key).push(msg);
  }

  const absorbedBy = new Map();
  const albumPhotos = new Map();

  for (const group of byTime.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id - b.id);
    const anchor =
      group.find((msg) => hasAlbumText(msg)) ||
      group.find((msg) => !isPhotoOnlyMessage(msg)) ||
      group[0];
    const ordered = group.filter((msg) => msg.photo);
    albumPhotos.set(
      anchor.id,
      ordered.map((msg) => msg.photo),
    );
    for (const msg of ordered) {
      if (msg.id !== anchor.id) absorbedBy.set(msg.id, anchor.id);
    }
  }

  return { absorbedBy, albumPhotos };
}

export function collectAlbumMessages(messages, anchorId) {
  // Возвращает сообщения выбранного альбома в исходном id-порядке либо одиночный якорь.

  const { absorbedBy, albumPhotos } = buildAlbumGroups(messages);
  const paths = albumPhotos.get(anchorId);
  if (!paths?.length) return [messages.find((m) => m.id === anchorId)].filter(Boolean);
  const idSet = new Set([anchorId, ...[...absorbedBy.entries()].filter(([, a]) => a === anchorId).map(([id]) => id)]);
  return messages
    .filter((m) => idSet.has(m.id))
    .sort((a, b) => a.id - b.id);
}
