"use client";
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
  const { user } = useAuth();
  const ownerId = user?.id;
  const resources = useMemo(
    () => ({ ownerId, active, slot, urls: new Map<string, string>() }),
    [ownerId, active, slot],
  );
  const [selection, setSelection] = useState<{
    resources: PhotoScope;
    photos: PrivatePostPhoto[];
  } | null>(null);
  const release = useCallback(() => {
    for (const url of resources.urls.values()) URL.revokeObjectURL(url);
    resources.urls.clear();
  }, [resources]);
  useEffect(() => release, [release]);
  const removePreview = (reference: string) => {
    const url = resources.urls.get(reference);
    if (url) URL.revokeObjectURL(url);
    resources.urls.delete(reference);
  };
  return {
    photos:
      active && selection?.resources === resources ? selection.photos : empty,
    preview: (reference: string) =>
      reference.startsWith("local-photo:")
        ? (resources.urls.get(reference) ?? "")
        : reference,
    add: async (source: File, operation: ScopedOperation) => {
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
      release();
      setSelection(null);
    },
  };
}
