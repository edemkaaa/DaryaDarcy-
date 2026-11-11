/** Пост может иметь публичный UUID или старый числовой адрес; разбор и построение ссылки используют одно правило. */
import { z } from "zod";
import { parseContentId } from "./content-id";

const publicPostId = z.uuidv4();

/** Разбираем старый числовой адрес или UUID v4; неподходящее значение не становится параметром API. */
export function parsePostAddress(value: string) {
  const id = parseContentId(value);
  if (id !== null) return { id };
  const parsed = publicPostId.safeParse(value);
  return parsed.success ? { publicId: parsed.data.toLowerCase() } : null;
}

/** Для новой ссылки предпочитаем publicId, оставляя числовой fallback для старых записей. */
export function postHref(post: { id: number; publicId?: string }) {
  return `/post/${post.publicId ?? post.id}`;
}
