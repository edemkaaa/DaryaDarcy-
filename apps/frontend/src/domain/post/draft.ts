import type { RichTextBlock } from "@/domain/content/types";
import { preparePostRichTextForSave } from "@/domain/content/rich-text-save";
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
/** Single serialization boundary shared by the full editor and quick editor. */
export function serializePostDraft(draft: PostDraft) {
  if (
    draft.status === "scheduled" &&
    (!draft.scheduledAt || Number.isNaN(draft.scheduledAt.getTime()))
  )
    throw new Error("Выберите дату и время публикации");
  if (draft.status !== "scheduled" && Number.isNaN(draft.publishedAt.getTime()))
    throw new Error("Выберите дату публикации");
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
      draft.status === "scheduled" ? draft.scheduledAt!.toISOString() : null,
    publishedAt:
      draft.status !== "scheduled" ? draft.publishedAt.toISOString() : null,
    richText: rich.richText,
  };
}
