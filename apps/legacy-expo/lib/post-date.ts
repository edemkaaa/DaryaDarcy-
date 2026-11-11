// Архив Expo. Предпочитает дату публикации и безопасно отклоняет невалидную дату создания.
export function postDisplayDate(post: {
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): Date | null {
  // Предпочитает дату публикации и безопасно отклоняет невалидную дату создания.

  const raw = post.publishedAt ?? post.createdAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
