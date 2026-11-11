/** Закрытые фотографии поста проходят проверку локального файла и серверного подтверждения, прежде чем попасть в сохранённый пост. */
import type { ApiInputs } from "@/shared/api/types";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import {
  validatePrivateContentFile,
  requirePrivateContentReceipt,
  uploadPrivateContentFile,
  type PrivateContentFile,
} from "@/shared/media/private-content-upload";
const prefix = "local-photo:";
export type PrivatePostPhoto = PrivateContentFile<"postPhoto">;
export type PrivatePostPhotoApi = {
  uploadPrivatePhoto?: (
    input: ApiInputs["admin"]["uploadPrivateContentFile"],
    signal: AbortSignal,
  ) => Promise<unknown>;
  privatePhotoStatus?: (
    input: ApiInputs["admin"]["privateContentFileStatus"],
    signal: AbortSignal,
  ) => Promise<unknown>;
};
export function privatePostPhotoReference(photo: PrivatePostPhoto): string {
  return `${prefix}${photo.key}`;
}
export function validatePrivatePostPhoto(photo: PrivatePostPhoto): void {
  validatePrivateContentFile(photo, "postPhoto");
}
export function requirePrivatePostPhotoReceipt(value: unknown, file: File) {
  return requirePrivateContentReceipt(value, file, "postPhoto");
}
export function selectPrivatePostPhotos(
  references: string[],
  selected: PrivatePostPhoto[],
): PrivatePostPhoto[] {
  const unique = new Map<string, PrivatePostPhoto>();
  for (const photo of selected) {
    validatePrivatePostPhoto(photo);
    if (unique.has(photo.key))
      throw new Error("Повторный ключ фото в черновике");
    unique.set(photo.key, photo);
  }
  const result: PrivatePostPhoto[] = [];
  for (const reference of references) {
    if (!reference.startsWith(prefix)) continue;
    const photo = unique.get(reference.slice(prefix.length));
    if (!photo || result.includes(photo))
      throw new Error("Исходное фото отсутствует или повторяется в черновике");
    result.push(photo);
  }
  return result;
}
export function resolvePrivatePostPhotos(
  references: string[],
  photos: PrivatePostPhoto[],
): string[] {
  return references.map((reference) => {
    if (!reference.startsWith(prefix)) return reference;
    const photo = photos.find(
      (item) => privatePostPhotoReference(item) === reference,
    );
    const receipt =
      photo?.receipt &&
      requirePrivatePostPhotoReceipt(photo.receipt, photo.file);
    if (receipt?.state !== "ready" || !receipt.url)
      throw new Error("Загрузка фото ещё не подтверждена");
    return receipt.url;
  });
}
/** Post references remain unchanged; the CF upload/status protocol is shared with articles. */
export async function uploadPrivatePostPhoto(
  photo: PrivatePostPhoto,
  api: PrivatePostPhotoApi,
  operation: ScopedOperation,
  checkpoint: () => Promise<void>,
): Promise<void> {
  if (!api.uploadPrivatePhoto || !api.privatePhotoStatus)
    throw new Error(
      "Закрытая загрузка фото недоступна. Фото осталось в черновике.",
    );
  await uploadPrivateContentFile(
    photo,
    "postPhoto",
    { upload: api.uploadPrivatePhoto, status: api.privatePhotoStatus },
    operation,
    checkpoint,
  );
}
