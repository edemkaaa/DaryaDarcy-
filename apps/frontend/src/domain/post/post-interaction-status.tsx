"use client";
/** Карточки используют одно представление ошибок отметок и повторного чтения подтверждённого состояния. */
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
/** Сообщаем ошибку отметок с действием читающего восстановления; кнопка не повторяет toggle. */
export function PostInteractionStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => Promise<void>;
}) {
  if (!error) return null;
  return (
    <StatusNotice
      tone="error"
      actions={
        <StatusNoticeAction onClick={() => void retry()}>
          Обновить отметки
        </StatusNoticeAction>
      }
    >
      {error}
    </StatusNotice>
  );
}
