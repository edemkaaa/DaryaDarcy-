/** Ожидаемая ревизия относится к прочитанной версии материала и передаётся серверу при сохранении изменений. */
import { z } from "zod";
import { invalidResponse } from "@/shared/api/errors";

// Validate revision metadata at the runtime boundary, including older stored
// drafts and responses from deployments predating the revision contract.
export const editBaseSchema = z.object({
  revision: z.string().min(1).optional(),
  snapshot: z.record(z.string(), z.unknown()),
});
export type ContentEditBase = z.infer<typeof editBaseSchema>;

/** Проверяем revision на границе ответа; undefined сохраняет совместимость со старым выпуском, пустая строка недопустима. */
export function readEditRevision(value: unknown): string | undefined {
  if (!value || typeof value !== "object") throw invalidResponse();
  const revision = (value as { editRevision?: unknown }).editRevision;
  if (revision === undefined) return undefined; // Compatibility before rollout.
  if (typeof revision !== "string" || !revision.length) throw invalidResponse();
  return revision;
}

/** Сохраняем исходную ревизию и независимую копию редактируемых полей для последующей сверки. */
export function captureEditBase(
  detail: unknown,
  snapshot: Record<string, unknown>,
): ContentEditBase {
  return {
    revision: readEditRevision(detail),
    snapshot: structuredClone(snapshot),
  };
}

/** Добавляем optimistic revision только когда она действительно известна, не выдумывая базовую версию. */
export function withExpectedRevision<T extends object>(
  input: T,
  revision?: string,
) {
  return {
    ...input,
    ...(revision !== undefined ? { expectedRevision: revision } : {}),
  };
}

const postKeys = [
  "text",
  "photos",
  "tags",
  "target",
  "status",
  "published",
  "sortOrder",
  "richText",
  "scheduledAt",
  "publishedAt",
];
const articleKeys = ["title", "coverUrl", "access", "published", "sections"];
/** Выбираем только поля, которые detail реально подтверждает; для поста разворачиваем media в видео и остальные вложения. */
export function editableSnapshot(
  value: unknown,
  kind: "post" | "article",
): Record<string, unknown> {
  if (!value || typeof value !== "object") throw invalidResponse();
  const record = value as Record<string, unknown>;
  const snapshot = Object.fromEntries(
    (kind === "post" ? postKeys : articleKeys)
      .filter((key) => key in record)
      .map((key) => [key, record[key]]),
  );
  if (kind === "post") {
    if (!Array.isArray(record.media)) throw invalidResponse();
    snapshot.videos = record.media
      .filter((item) => item.type === "video")
      .map((item) => item.url);
    snapshot.attachments = record.media.filter((item) => item.type !== "video");
  }
  return snapshot;
}

/** Стабилизируем порядок ключей и ISO-даты перед сравнением; массивы сохраняют семантический порядок. */
function normalize(value: unknown, key?: string): unknown {
  if (
    value instanceof Date ||
    (typeof value === "string" && key?.endsWith("At"))
  ) {
    const date = new Date(value as string | Date);
    return Number.isFinite(date.getTime()) ? date.toISOString() : value;
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, item]) => [name, normalize(item, name)]),
    );
  return value;
}

/** Признаём commit только по доказуемым полям detail; privateAssetIds/posters не подтверждаются старым контрактом автоматически. */
export function matchesEditableWrite(
  detail: unknown,
  wanted: Record<string, unknown>,
  kind: "post" | "article",
): boolean {
  const actual = editableSnapshot(detail, kind);
  return Object.entries(wanted).every(([key, value]) => {
    if (key === "expectedRevision") return true;
    if (key === "removedMediaIds") {
      const media = (detail as { media?: { id: number }[] }).media;
      return (
        Array.isArray(value) &&
        Array.isArray(media) &&
        value.every((id) => !media.some((item) => item.id === id))
      );
    }
    // Private binding IDs are not all exposed by the legacy detail contract.
    if (["privateAssetIds", "privateVideoPosters"].includes(key)) return false;
    if (key === "attachments") {
      const media = actual.attachments;
      return (
        Array.isArray(value) &&
        Array.isArray(media) &&
        value.every((file) =>
          media.some((item) =>
            ["type", "url", "filename", "mimeType", "fileSize"].every(
              (field) => item[field] === file[field],
            ),
          ),
        )
      );
    }
    return (
      key in actual &&
      JSON.stringify(normalize(actual[key], key)) ===
        JSON.stringify(normalize(value, key))
    );
  });
}
