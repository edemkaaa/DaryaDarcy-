"use client";
/** Состояние загрузки объясняет неподтверждённые вложения и доступные действия восстановления, не обещая завершённую запись поста. */
import { Typography } from "@/shared/ui/elements";
import {
  StatusNotice,
  StatusNoticeAction as Action,
} from "@/shared/ui/status-notice";
import type { usePostUploadSelection } from "./use-post-upload-selection";

export function PostUploadStatus({
  selection,
  busy,
  subject = "поста",
}: {
  selection: ReturnType<typeof usePostUploadSelection>;
  busy: boolean;
  subject?: "поста" | "комментария";
}) {
  // Не скрывает выбранные, но не подтверждённые файлы; явный отказ очищает локальное ожидание, а не серверный объект.

  if (!selection.pending.length) return null;
  return (
    <StatusNotice tone="error">
      <Typography>
        Выбранные файлы ещё не добавлены:{" "}
        {selection.pending.map((item) => item.name).join(", ")}
      </Typography>
      <Typography>
        {selection.pending.some((item) => item.uncertain)
          ? `Результат загрузки не подтверждён. Повторная загрузка автоматически не выполняется; сохранение ${subject} пока заблокировано.`
          : `Дождитесь загрузки или откажитесь от этих файлов перед сохранением ${subject}.`}
      </Typography>
      <Action
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              "Отказаться от выбранных неподтверждённых файлов? Ранее подтверждённые файлы останутся; неподтверждённая загрузка могла сохраниться на сервере.",
            )
          )
            selection.reset();
        }}
      >
        Отказаться от выбранных файлов
      </Action>
    </StatusNotice>
  );
}
