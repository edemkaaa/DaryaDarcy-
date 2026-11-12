/** Снимок поста отделяет редактируемые поля от сетевого транспорта; сравнение снимков используется при восстановлении и конфликтах. */
import type { RichTextBlock } from "@/domain/content/types";
import { preparePostRichTextForSave } from "@/domain/content/rich-text-save";
import { assertPostTextSize } from "./text-limit";
export type PostDraft = {
  text: string;
  photos: string[];
  videos: string[];
  tags: string[];
  status: "draft" | "scheduled" | "published";
  target: "feed" | "club" | "both";
  scheduledAt: Date | null;
  publishedAt: Date;
  sortOrder: number;
  richText?: RichTextBlock[] | null;
};
/** Планирование требует будущего момента; архивная дата публикации проверяется отдельно. */
export function scheduleDateError(
  date: Date | null,
  now = Date.now(),
): string | null {
  if (!date || !Number.isFinite(date.getTime()))
    return "Выберите дату и время публикации";
  return date.getTime() <= now ? "Выберите дату и время в будущем" : null;
}
/** В общей точке сохранения проверяем выбранную дату и размер текста; оба редактора отправляют один нормализованный payload. */
export function serializePostDraft(draft: PostDraft) {
  if (draft.status === "scheduled") {
    const error = scheduleDateError(draft.scheduledAt);
    if (error) throw new Error(error);
  }
  if (draft.status !== "scheduled" && Number.isNaN(draft.publishedAt.getTime()))
    throw new Error("Выберите дату публикации");
  const payload = postDraftSnapshot(draft);
  assertPostTextSize(payload.text);
  return payload;
}
/** Снимок допускает ещё не заполненную дату расписания, нормализует richText и сериализует только подходящую статусу дату. */
export function postDraftSnapshot(draft: PostDraft) {
  const rich = preparePostRichTextForSave(
    draft.text || " ",
    draft.richText ?? null,
  );
  return {
    text: rich.text || " ",
    photos: draft.photos,
    videos: draft.videos,
    tags: draft.tags,
    published: draft.status === "published",
    sortOrder: draft.sortOrder,
    status: draft.status,
    target: draft.target,
    scheduledAt:
      draft.status === "scheduled" &&
      draft.scheduledAt &&
      Number.isFinite(draft.scheduledAt.getTime())
        ? draft.scheduledAt.toISOString()
        : null,
    publishedAt:
      draft.status !== "scheduled" &&
      Number.isFinite(draft.publishedAt.getTime())
        ? draft.publishedAt.toISOString()
        : null,
    richText: rich.richText,
  };
}
