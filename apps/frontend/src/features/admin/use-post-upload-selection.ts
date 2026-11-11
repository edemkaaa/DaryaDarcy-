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
  // Неподтверждённый выбор не считается пустым списком вложений и блокирует сохранение до разрешения его исхода.

  const current = useRef<PendingUpload[]>([]);
  const nextId = useRef(0);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const commit = useCallback((value: PendingUpload[]) => {
    // Обновляет синхронный снимок и React-состояние совместно, чтобы последующий обработчик видел последний выбор.

    current.current = value;
    setPending(value);
  }, []);
  const reset = useCallback(() => /* Очищает только список ожидающих выборов при явном сбросе формы. */ commit([]), [commit]);
  return {
    pending,
    reset,
    snapshot: () => /* Возвращает актуальное ожидание для durable контрольной точки без задержки React-рендера. */ current.current,
    restore: (items: PendingUpload[]) => {
      // Восстанавливает ID и помечает прерванную отправку неопределённой, не объявляя её неуспешной.

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
      // Не позволяет сохранить пост, пока выбранные файлы не добавлены или явно не отклонены.

      if (current.current.length) throw new Error(unresolved);
    },
    select: (files: readonly File[]) => {
      // Запрещает новый выбор поверх прежнего ожидания и выдаёт локальные ID для независимого подтверждения.

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
      /* Помечает один выбранный файл отправляемым до сетевого запроса. */ commit(
        current.current.map((item) =>
          item.id === id ? { ...item, sending: true } : item,
        ),
      ),
    confirmed: (id: number) =>
      /* Снимает ожидание лишь подтверждённого файла, сохраняя остальные. */ commit(current.current.filter((item) => item.id !== id)),
    failed: (id: number | undefined, error: unknown) => {
      // Отличает определённый HTTP-отказ от сетевого/серверного сбоя после отправки, когда запись могла состояться.

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
