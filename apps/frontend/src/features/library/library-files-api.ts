/** Страницы файлов проверяем по MIME, ключам и каноническим URL; повтор курсора или привязки завершает чтение ошибкой. */
import { z } from "zod";
import { apiCall } from "@/shared/api/auth";
import { invalidResponse } from "@/shared/api/errors";
import type { AestheticGuideKey } from "@shared/aesthetic-guide";

export type LibraryMaterialKey =
  | "recipes"
  | "peterburg"
  | "patterns"
  | `aesthetic-${Lowercase<AestheticGuideKey>}`;
export const isPrivateLibraryEnabled = () =>
  process.env.NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED === "true";
export function libraryMaterialKey(value: string): LibraryMaterialKey | null {
  return value === "recipes" ||
    value === "peterburg" ||
    value === "patterns" ||
    /^aesthetic-(?:castlecore|cottagecore|darkacademia|fairycore|goblincore|lightacademia|witchcore)$/.test(
      value,
    )
    ? (value as LibraryMaterialKey)
    : null;
}
const integer = z.number().int().safe().nonnegative();
const cursor = z.string().regex(/^(0|[1-9]\d*):[1-9]\d*$/);
// Keep the server's allowlist and bounded MIME parameter syntax. Charset is
// delivery metadata, not a different file format; never accept active content.
const libraryMime = z
  .string()
  .max(128)
  .regex(
    /^(?:image\/(?:jpeg|png|webp)|application\/(?:pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)(?: *; *[!#$%&'*+.^_`|~a-z0-9-]+=(?:[!#$%&'*+.^_`|~a-z0-9-]+|"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"))* *$/i,
  )
  .refine((value) => !/[\x00-\x1f\x7f]/.test(value));
const file = z
  .object({
    fileKey: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    sortOrder: integer,
    revision: integer.positive(),
    filename: z
      .string()
      .min(1)
      .max(512)
      .refine((value) => !/[\x00-\x1f\x7f/\\]/.test(value)),
    mimeType: libraryMime,
    fileSize: integer.positive(),
    url: z.string(),
  })
  .strict();
const page = z
  .object({ files: z.array(file).max(50), nextCursor: cursor.nullable() })
  .strict();
export type LibraryFile = z.infer<typeof file>;

export function parseLibraryFiles(
  value: unknown,
  material: LibraryMaterialKey,
) {
  const parsed = page.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  const keys = new Set<string>();
  for (const entry of parsed.data.files) {
    if (
      entry.url !== `/api/media/library-files/${material}/${entry.fileKey}` ||
      keys.has(entry.fileKey)
    )
      throw invalidResponse();
    keys.add(entry.fileKey);
  }
  return parsed.data;
}

/** No direct/public URL fallback, including on empty, partial or failed reads. */
export async function getLibraryFiles(
  material: LibraryMaterialKey,
  signal: AbortSignal,
  read = (path: string, signal: AbortSignal) =>
    apiCall<unknown>(path, { signal }),
): Promise<LibraryFile[]> {
  // Привязки собираются целиком до показа: частичная или повторяющаяся страница не становится списком скачивания.
  const files: LibraryFile[] = [],
    keys = new Set<string>(),
    cursors = new Set<string>();
  let next: string | null = null;
  do {
    const result = parseLibraryFiles(
      await read(
        `/api/library/materials/${material}/files${next ? `?cursor=${encodeURIComponent(next)}` : ""}`,
        signal,
      ),
      material,
    );
    for (const entry of result.files) {
      if (keys.has(entry.fileKey)) throw invalidResponse();
      keys.add(entry.fileKey);
      files.push(entry);
    }
    if (result.nextCursor !== null) {
      if (
        !result.files.length ||
        cursors.has(result.nextCursor) ||
        cursors.size >= 20
      )
        throw invalidResponse();
      cursors.add(result.nextCursor);
    }
    next = result.nextCursor;
  } while (next !== null);
  return files;
}
