import type { ApiInputs } from "@/shared/api/types";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { attachmentBase64 } from "@/shared/media/read-attachment";

const maxBytes = 4 * 1024 * 1024;
const keyPattern = /^[A-Za-z0-9._:-]{16,128}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const prefix = "local-photo:";
type PhotoReceipt = {
  state: "pending" | "ready";
  assetId: string;
  usage: "postPhoto";
  filename: string;
  mimeType: "image/webp";
  fileSize: number;
  url?: string;
};
export type PrivatePostPhoto = {
  readonly key: string;
  readonly file: File;
  attempted?: boolean;
  receipt?: PhotoReceipt;
};
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
  if (
    !keyPattern.test(photo.key) ||
    !(photo.file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(photo.file.type) ||
    photo.file.size < 1 ||
    photo.file.size > maxBytes ||
    !photo.file.name.trim() ||
    photo.file.name.length > 512 ||
    /[\x00-\x1f\x7f]/.test(photo.file.name)
  )
    throw new Error("Не удалось проверить исходное фото в черновике");
}

/** CF photos are re-encoded on the server; their receipt size differs from File.size. */
export function requirePrivatePostPhotoReceipt(
  value: unknown,
  file: File,
): PhotoReceipt {
  const item = value as Partial<PhotoReceipt> | null;
  if (
    !item ||
    typeof item !== "object" ||
    Object.keys(item).some(
      (key) =>
        ![
          "state",
          "assetId",
          "usage",
          "filename",
          "mimeType",
          "fileSize",
          "url",
        ].includes(key),
    ) ||
    !["pending", "ready"].includes(item.state ?? "") ||
    typeof item.assetId !== "string" ||
    !uuidPattern.test(item.assetId) ||
    item.usage !== "postPhoto" ||
    item.filename !== file.name.trim() ||
    item.mimeType !== "image/webp" ||
    !Number.isSafeInteger(item.fileSize) ||
    item.fileSize! < 1 ||
    item.fileSize! > maxBytes ||
    (item.state === "ready"
      ? item.url !== `/api/media/content-files/${item.assetId}`
      : item.url !== undefined)
  )
    throw new Error("Сервер не подтвердил закрытое фото");
  return {
    state: item.state!,
    assetId: item.assetId,
    usage: item.usage,
    filename: item.filename,
    mimeType: item.mimeType,
    fileSize: item.fileSize!,
    ...(item.url ? { url: item.url } : {}),
  };
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

/** Caller checkpoints the entire post snapshot, including this immutable File and key. */
export async function uploadPrivatePostPhoto(
  photo: PrivatePostPhoto,
  api: PrivatePostPhotoApi,
  operation: ScopedOperation,
  checkpoint: () => Promise<void>,
): Promise<void> {
  operation.assertCurrent();
  validatePrivatePostPhoto(photo);
  if (!api.uploadPrivatePhoto || !api.privatePhotoStatus)
    throw new Error(
      "Закрытая загрузка фото недоступна. Фото осталось в черновике.",
    );
  if (photo.receipt?.state === "ready") {
    requirePrivatePostPhotoReceipt(photo.receipt, photo.file);
    return;
  }
  const accept = async (result: unknown) => {
    operation.assertCurrent();
    const receipt = requirePrivatePostPhotoReceipt(result, photo.file);
    if (photo.receipt && photo.receipt.assetId !== receipt.assetId)
      throw new Error("Изменилось подтверждение закрытого фото");
    photo.receipt = receipt;
    await checkpoint();
    operation.assertCurrent();
    return receipt.state === "ready";
  };
  if (photo.attempted) {
    const result = await api.privatePhotoStatus(
      { idempotencyKey: photo.key },
      operation.signal,
    );
    operation.assertCurrent();
    if (
      result &&
      typeof result === "object" &&
      (result as { state?: unknown }).state === "notRecorded"
    ) {
      if (Object.keys(result).length !== 1)
        throw new Error("Сервер не подтвердил статус закрытого фото");
    } else {
      if (await accept(result)) return;
    }
  }
  photo.attempted = true;
  await checkpoint();
  operation.assertCurrent();
  const base64 = await attachmentBase64(photo.file, operation.signal);
  operation.assertCurrent();
  const result = await api.uploadPrivatePhoto(
    {
      idempotencyKey: photo.key,
      usage: "postPhoto",
      filename: photo.file.name,
      mimeType: photo.file.type,
      base64,
    },
    operation.signal,
  );
  if (!(await accept(result)))
    throw new Error(
      "Загрузка фото ещё не подтверждена. Проверьте результат перед повтором.",
    );
}
