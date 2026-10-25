import { and, asc, eq, gt, or } from "drizzle-orm";
import {
  libraryFileBindings,
  privateContentFiles,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { libraryMaterialKeys } from "./library-material-keys";
import {
  privateStorageNamespace,
  privateAttachmentObjectKey,
} from "../media/private-upload-object";

export const libraryMaterialKey = (key: string) =>
  (libraryMaterialKeys as readonly string[]).includes(key);
export const libraryFileKey = (key: string) =>
  /^[a-z][a-z0-9-]{0,63}$/.test(key);
export const libraryFilesEnabled = () =>
  process.env.PRIVATE_LIBRARY_FILES_ENABLED === "true" &&
  process.env.PRIVATE_CONTENT_FILES_ENABLED === "true";
export const libraryFileUrl = (material: string, file: string) =>
  `/api/media/library-files/${material}/${file}`;

/** A retained old version cannot be read by assetId after a binding switches. */
export async function libraryFileActive(
  file: typeof privateContentFiles.$inferSelect,
) {
  if (
    !libraryFilesEnabled() ||
    file.parentKind !== "library" ||
    !file.parentId ||
    !["libraryPhoto", "libraryDocument"].includes(file.usage)
  )
    return false;
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  const [binding] = await database
    .select()
    .from(libraryFileBindings)
    .where(eq(libraryFileBindings.id, file.parentId))
    .limit(1);
  return Boolean(
    binding?.enabled &&
    binding.assetId === file.assetId &&
    libraryMaterialKey(binding.materialKey) &&
    libraryFileKey(binding.fileKey),
  );
}

export async function libraryFile(material: string, key: string) {
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  const [row] = await database
    .select({ binding: libraryFileBindings, file: privateContentFiles })
    .from(libraryFileBindings)
    .innerJoin(
      privateContentFiles,
      eq(privateContentFiles.assetId, libraryFileBindings.assetId),
    )
    .where(
      and(
        eq(libraryFileBindings.materialKey, material),
        eq(libraryFileBindings.fileKey, key),
      ),
    )
    .limit(1);
  if (
    !row ||
    !row.binding.enabled ||
    row.file.parentKind !== "library" ||
    row.file.parentId !== row.binding.id ||
    row.file.state !== "ready" ||
    row.file.retiredAt ||
    !row.file.etag ||
    row.file.namespaceHash !== privateStorageNamespace().hash ||
    !["libraryPhoto", "libraryDocument"].includes(row.file.usage)
  )
    return;
  return {
    key: privateAttachmentObjectKey("document", row.file.assetId, "content"),
    mime: row.file.mimeType,
    etag: row.file.etag,
    inline: row.file.usage === "libraryPhoto",
  };
}

export async function listLibraryFiles(
  material: string,
  cursor: [number, number] | null,
) {
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  const rows = await database
    .select({ binding: libraryFileBindings, file: privateContentFiles })
    .from(libraryFileBindings)
    .leftJoin(
      privateContentFiles,
      eq(privateContentFiles.assetId, libraryFileBindings.assetId),
    )
    .where(
      and(
        eq(libraryFileBindings.materialKey, material),
        eq(libraryFileBindings.enabled, true),
        cursor
          ? or(
              gt(libraryFileBindings.sortOrder, cursor[0]),
              and(
                eq(libraryFileBindings.sortOrder, cursor[0]),
                gt(libraryFileBindings.id, cursor[1]),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(libraryFileBindings.sortOrder), asc(libraryFileBindings.id))
    .limit(51);
  const page = rows.slice(0, 50);
  const files = page.map(({ binding, file }) => {
    if (
      !file ||
      file.parentKind !== "library" ||
      file.parentId !== binding.id ||
      file.state !== "ready" ||
      !file.etag ||
      file.retiredAt ||
      file.namespaceHash !== privateStorageNamespace().hash ||
      !["libraryPhoto", "libraryDocument"].includes(file.usage)
    )
      throw new Error("Library binding unavailable");
    return {
      fileKey: binding.fileKey,
      sortOrder: binding.sortOrder,
      revision: binding.revision,
      filename: file.filename,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      url: libraryFileUrl(material, binding.fileKey),
    };
  });
  return {
    files,
    nextCursor:
      rows.length > 50
        ? `${page.at(-1)!.binding.sortOrder}:${page.at(-1)!.binding.id}`
        : null,
  };
}
