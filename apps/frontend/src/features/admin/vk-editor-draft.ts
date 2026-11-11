/** Черновик каталожного VK-ролика хранит базовую ревизию и исходные поля для сравнения после конфликта или потери ответа. */
import { z } from "zod";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { invalidResponse } from "@/shared/api/errors";
import {
  getVkCatalogEmbedUrl,
  normalizeVkThumbnailUrl,
  parseVkEditorDetail,
  type VkEditorDetail,
} from "@/features/videos/catalog-api";

const detail = z.unknown().transform((value) => {
  const id = z
    .object({ id: z.number().int().positive().safe() })
    .parse(value).id;
  return parseVkEditorDetail(value, id);
});
const payloadSchema = z
  .object({
    id: z.number().int().positive().safe().optional(),
    expectedRevision: z.number().int().nonnegative().safe().optional(),
    title: z.string().min(1).max(512),
    embedUrl: z.string(),
    access: z.enum(["public", "club"]),
    published: z.boolean(),
    thumbnailUrl: z.string().nullable().optional(),
  })
  .strict();
const schema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    editing: z.boolean(),
    id: z.string().max(16),
    title: z.string().max(512),
    embedUrl: z.string().max(2048),
    access: z.enum(["public", "club"]),
    published: z.boolean(),
    thumbnailUrl: z.string().max(2048),
    thumbnailChanged: z.boolean(),
    base: detail.nullable(),
    review: detail.nullable(),
    state: z.enum(["draft", "uncertain", "conflict", "saved"]),
    savedId: z.number().int().positive().safe().nullable(),
    writePayload: payloadSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      (!value.base || (value.editing && String(value.base.id) === value.id)) &&
      (!value.review || value.base?.id === value.review.id) &&
      (!value.writePayload ||
        (value.writePayload.id ===
          (value.editing ? value.base?.id : undefined) &&
          value.writePayload.expectedRevision ===
            (value.editing ? value.base?.editRevision : undefined) &&
          value.writePayload.title === value.title.trim() &&
          value.writePayload.embedUrl ===
            getVkCatalogEmbedUrl(value.embedUrl) &&
          value.writePayload.access === value.access &&
          value.writePayload.published === value.published)),
  );
export type VkEditorDraft = z.infer<typeof schema>;
export type VkEditorPayload = {
  id?: number;
  expectedRevision?: number;
  title: string;
  embedUrl: string;
  access: "public" | "club";
  published: boolean;
  thumbnailUrl?: string | null;
};
export const vkEditorDraftKey = (ownerId: number) =>
  `darcy:user:${ownerId}:vk-editor:v1`;
export function emptyVkEditorDraft(ownerId: number): VkEditorDraft {
  return {
    version: 1,
    ownerId,
    editing: false,
    id: "",
    title: "",
    embedUrl: "",
    access: "club",
    published: false,
    thumbnailUrl: "",
    thumbnailChanged: false,
    base: null,
    review: null,
    state: "draft",
    savedId: null,
    writePayload: null,
  };
}
/** Tab-local storage survives reload without allowing another tab to replace this draft. */
export class VkEditorDraftStore {
  constructor(readonly ownerId: number) {}
  private assertOwner() {
    if (!isPersonalDataOwner(this.ownerId))
      throw new Error("Аккаунт редактора изменился.");
  }
  read(): VkEditorDraft | null {
    this.assertOwner();
    try {
      const raw = window.sessionStorage.getItem(vkEditorDraftKey(this.ownerId));
      if (raw === null) return null;
      if (raw.length > 20_000) throw invalidResponse();
      const value = schema.parse(JSON.parse(raw));
      if (value.ownerId !== this.ownerId) throw invalidResponse();
      return value;
    } catch {
      throw new Error(
        "Не удалось прочитать черновик VK. Сохранение видео заблокировано.",
      );
    }
  }
  save(value: VkEditorDraft) {
    this.assertOwner();
    try {
      const parsed = schema.parse(value);
      if (parsed.ownerId !== this.ownerId) throw invalidResponse();
      const raw = JSON.stringify(parsed);
      window.sessionStorage.setItem(vkEditorDraftKey(this.ownerId), raw);
      if (window.sessionStorage.getItem(vkEditorDraftKey(this.ownerId)) !== raw)
        throw invalidResponse();
    } catch {
      throw new Error(
        "Не удалось сохранить черновик VK в этой вкладке. Не закрывайте форму; перед новой отправкой восстановите хранение данных.",
      );
    }
    this.assertOwner();
    return value;
  }
}
export function draftFromVkDetail(
  ownerId: number,
  value: VkEditorDetail,
): VkEditorDraft {
  return {
    ...emptyVkEditorDraft(ownerId),
    editing: true,
    id: String(value.id),
    title: value.title,
    embedUrl: value.embedUrl ?? "",
    access: value.access,
    published: value.published,
    thumbnailUrl: value.thumbnailUrl ?? "",
    base: value,
  };
}
export function vkEditorPayload(
  draft: VkEditorDraft,
  thumbnailsEnabled: boolean,
): VkEditorPayload {
  if (!draft.editing && draft.state === "uncertain" && draft.writePayload)
    return { ...draft.writePayload };
  const embedUrl = getVkCatalogEmbedUrl(draft.embedUrl);
  if (!embedUrl || !draft.title.trim() || draft.title.trim().length > 512)
    throw new Error("Укажите название и экспортируемую ссылку VK.");
  if (draft.editing && (!draft.base || draft.id !== String(draft.base.id)))
    throw new Error("Сначала загрузите данные видео по ID.");
  if (draft.editing && draft.state !== "draft")
    throw new Error(
      "Проверьте актуальную версию и явно подтвердите сверку перед сохранением.",
    );
  const payload: VkEditorPayload = {
    title: draft.title.trim(),
    embedUrl,
    access: draft.access,
    published: draft.published,
    ...(draft.editing && draft.base
      ? { id: draft.base.id, expectedRevision: draft.base.editRevision }
      : {}),
  };
  if (thumbnailsEnabled && draft.thumbnailChanged) {
    const thumbnailUrl =
      draft.thumbnailUrl === ""
        ? null
        : normalizeVkThumbnailUrl(draft.thumbnailUrl);
    if (thumbnailUrl === null && draft.thumbnailUrl !== "")
      throw new Error(
        "Укажите публичный адрес обложки без параметров или очистите поле для удаления обложки.",
      );
    payload.thumbnailUrl = thumbnailUrl;
  }
  return payload;
}
/** Reading a newer version never silently changes the version being edited. */
export function reviewVkDraft(
  draft: VkEditorDraft,
  current: VkEditorDetail,
): VkEditorDraft {
  if (!draft.base || draft.base.id !== current.id) throw invalidResponse();
  return { ...draft, review: current };
}
export function reconcileVkDraft(draft: VkEditorDraft): VkEditorDraft {
  if (!draft.review || draft.review.id !== draft.base?.id)
    throw invalidResponse();
  return {
    ...draft,
    base: draft.review,
    review: null,
    state: "draft",
    savedId: null,
    writePayload: null,
    ...(!draft.thumbnailChanged
      ? { thumbnailUrl: draft.review.thumbnailUrl ?? "" }
      : {}),
  };
}
