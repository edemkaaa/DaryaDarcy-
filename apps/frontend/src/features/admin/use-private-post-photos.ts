"use client";
/** Закрытые фото связываются с локальными исходниками; смена слота или аккаунта освобождает прежние preview URL. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import {
  privatePostPhotoReference,
  validatePrivatePostPhoto,
  type PrivatePostPhoto,
} from "@/domain/post/private-photo-upload";
import { fileForPhotoUpload } from "@/shared/media/image-upload";
import type { ScopedOperation } from "@/shared/browser/operation-scope";

const empty: PrivatePostPhoto[] = [];
type PhotoScope = {
  ownerId: number | undefined;
  active: boolean;
  slot: string | number;
  urls: Map<string, string>;
};
/** Blob URLs belong to this editor/account only; durable records contain File bytes, never URLs. */
export function usePrivatePostPhotos(active: boolean, slot: string | number) {
  // Разделяет фото по владельцу и слоту; в журнал идут File, а временные адреса принадлежат только открытому редактору.

  const { user } = useAuth();
  const ownerId = user?.id;
  const resources = useMemo(
    () => /* Создаёт отдельное хранилище превью при смене владельца, активности или поста. */ ({ ownerId, active, slot, urls: new Map<string, string>() }),
    [ownerId, active, slot],
  );
  const [selection, setSelection] = useState<{
    resources: PhotoScope;
    photos: PrivatePostPhoto[];
  } | null>(null);
  const release = useCallback(() => {
    // Освобождает Blob URL текущей области без удаления исходных файлов.

    for (const url of resources.urls.values()) URL.revokeObjectURL(url);
    resources.urls.clear();
  }, [resources]);
  useEffect(() => /* При закрытии или смене области освобождает её браузерные адреса. */ release, [release]);
  const removePreview = (reference: string) => {
    // Удаляет адрес только снятого фото и освобождает его браузерную память.

    const url = resources.urls.get(reference);
    if (url) URL.revokeObjectURL(url);
    resources.urls.delete(reference);
  };
  return {
    photos:
      active && selection?.resources === resources ? selection.photos : empty,
    preview: (reference: string) =>
      /* Разрешает local-photo только через собственную карту; серверные URL возвращает без подмены. */ reference.startsWith("local-photo:")
        ? (resources.urls.get(reference) ?? "")
        : reference,
    add: async (source: File, operation: ScopedOperation) => {
      // Готовит совместимое фото с сохранением прозрачности, проверяет актуальность операции и создаёт локальную ссылку.

      const file = await fileForPhotoUpload(source, {
        preserveAlpha: true,
        signal: operation.signal,
      });
      operation.assertCurrent();
      const photo = { key: crypto.randomUUID(), file };
      validatePrivatePostPhoto(photo);
      const reference = privatePostPhotoReference(photo);
      resources.urls.set(reference, URL.createObjectURL(file));
      setSelection((previous) => ({
        resources,
        photos: [
          ...(previous?.resources === resources ? previous.photos : []),
          photo,
        ],
      }));
      return reference;
    },
    removePreview,
    restore: (photos: PrivatePostPhoto[], references: string[]) => {
      // Восстанавливает адреса только выбранных ссылок из сохранённых File, а не из устаревших Blob URL.

      release();
      for (const photo of photos) {
        validatePrivatePostPhoto(photo);
        const reference = privatePostPhotoReference(photo);
        if (references.includes(reference))
          resources.urls.set(reference, URL.createObjectURL(photo.file));
      }
      setSelection({ resources, photos });
    },
    reset: () => {
      // Закрывает все локальные превью и очищает выбор формы.

      release();
      setSelection(null);
    },
  };
}
