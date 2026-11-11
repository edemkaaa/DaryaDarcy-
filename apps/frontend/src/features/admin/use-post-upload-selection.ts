"use client";
/** Незавершённый выбор файлов хранится отдельно от подтверждённых вложений и передаётся восстановлению редактора. */
import { useCallback, useRef, useState } from "react";
import { getHttpStatus } from "@/shared/api/errors";
import type { PendingPostUpload } from "@/domain/post/recovery-store";

type PendingUpload = PendingPostUpload;
const unresolved =
  "Выбранные файлы ещё не добавлены. Проверьте результат загрузки или явно откажитесь от выбранных файлов перед сохранением.";

/** A selected file is not an empty media list, even when its upload failed. */
export function usePostUploadSelection() {
  const current = useRef<PendingUpload[]>([]);
  const nextId = useRef(0);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const commit = useCallback((value: PendingUpload[]) => {
    current.current = value;
    setPending(value);
  }, []);
  const reset = useCallback(() => commit([]), [commit]);
  return {
    pending,
    reset,
    snapshot: () => current.current,
    restore: (items: PendingUpload[]) => {
      nextId.current = Math.max(0, ...items.map((item) => item.id));
      commit(
        items.map((item) => ({
          ...item,
          sending: false,
          uncertain: item.uncertain || item.sending,
        })),
      );
    },
    assertReady: () => {
      if (current.current.length) throw new Error(unresolved);
    },
    select: (files: readonly File[]) => {
      if (current.current.length) throw new Error(unresolved);
      const selected = files.map((file) => ({
        id: ++nextId.current,
        name: file.name,
        sending: false,
        uncertain: false,
      }));
      commit(selected);
      return selected.map((item) => item.id);
    },
    sending: (id: number) =>
      commit(
        current.current.map((item) =>
          item.id === id ? { ...item, sending: true } : item,
        ),
      ),
    confirmed: (id: number) =>
      commit(current.current.filter((item) => item.id !== id)),
    failed: (id: number | undefined, error: unknown) => {
      const status = getHttpStatus(error);
      commit(
        current.current.map((item) =>
          item.id === id
            ? {
                ...item,
                sending: false,
                uncertain: item.sending && (!status || status >= 500),
              }
            : item,
        ),
      );
    },
  };
}
