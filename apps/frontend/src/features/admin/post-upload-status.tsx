"use client";
import { Action, Typography } from "@/shared/ui/elements";
import type { usePostUploadSelection } from "./use-post-upload-selection";
import classes from "./post-upload-status.module.scss";

export function PostUploadStatus({
  selection,
  busy,
}: {
  selection: ReturnType<typeof usePostUploadSelection>;
  busy: boolean;
}) {
  if (!selection.pending.length) return null;
  return (
    <div role="alert" className={classes.notice}>
      <Typography>
        Выбранные файлы ещё не добавлены:{" "}
        {selection.pending.map((item) => item.name).join(", ")}
      </Typography>
      <Typography>
        {selection.pending.some((item) => item.uncertain)
          ? "Результат загрузки не подтверждён. Повторная загрузка автоматически не выполняется; сохранение поста пока заблокировано."
          : "Дождитесь загрузки или откажитесь от этих файлов перед сохранением поста."}
      </Typography>
      <Action
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              "Отказаться от выбранных неподтверждённых файлов? Они не будут включены в пост. Ранее подтверждённые файлы останутся; неподтверждённая загрузка могла сохраниться на сервере.",
            )
          )
            selection.reset();
        }}
      >
        Отказаться от выбранных файлов
      </Action>
    </div>
  );
}
