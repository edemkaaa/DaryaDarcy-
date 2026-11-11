"use client";
/** Дата публикации для пользовательских списков выбирается отдельно от технической даты создания записи. */
export function postDisplayDate(post: {
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): Date | null {
  const raw = post.publishedAt ?? post.createdAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
