"use client";
/** Карточки используют одно представление ошибок отметок и повторного чтения подтверждённого состояния. */
import { useBackgroundNotice } from "@/shared/ui/background-notice";
/** Сообщаем ошибку отметок с действием читающего восстановления; кнопка не повторяет toggle. */
export function PostInteractionStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => Promise<void>;
}) {
  useBackgroundNotice({
    when: Boolean(error),
    message: error ?? "",
    tone: "error",
    priority: 3,
    actions: [
      {
        id: "refresh-post-interactions",
        icon: "refresh",
        label: "Обновить отметки",
        onClick: retry,
      },
    ],
  });
  return null;
}
