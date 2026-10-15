"use client";
import { Action, Typography } from "@/shared/ui/elements";
import type { usePostRecovery } from "./use-post-recovery";
import classes from "./post-upload-status.module.scss";

export function PostRecoveryNotice({
  recovery,
  busy,
  onRecover,
  onFinish,
  onDiscard,
}: {
  recovery: ReturnType<typeof usePostRecovery>;
  busy: boolean;
  onRecover: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  if (recovery.status === "loading")
    return (
      <div role="status" className={classes.notice}>
        Проверяем сохранённый черновик…
      </div>
    );
  if (recovery.status === "offered")
    return (
      <div role="status" className={classes.notice}>
        <Typography>
          На этом устройстве есть незавершённая публикация.
        </Typography>
        <Action onClick={recovery.restore}>Восстановить черновик</Action>
        <Action onClick={onDiscard}>Удалить локальную копию</Action>
      </div>
    );
  if (recovery.status === "error")
    return (
      <div role="alert" className={classes.notice}>
        <Typography>{recovery.error}</Typography>
        <Action
          disabled={busy}
          onClick={() => {
            void recovery.retryStorage().catch(() => {});
          }}
        >
          Повторить сохранение черновика
        </Action>
        <Action disabled={busy} onClick={onDiscard}>
          Проверил список — удалить локальную копию
        </Action>
      </div>
    );
  const phase = recovery.saveState?.phase;
  if (phase === "complete")
    return (
      <div role="status" className={classes.notice}>
        <Typography>
          Публикация №{recovery.saveState?.savedId} сохранена.
        </Typography>
        <Action disabled={busy} onClick={onFinish}>
          Завершить восстановление
        </Action>
      </div>
    );
  if (phase && phase !== "idle" && !busy)
    return (
      <div role="alert" className={classes.notice}>
        <Typography>
          Результат предыдущего сохранения не подтверждён. Новая отправка
          заблокирована.
        </Typography>
        {phase === "create" ||
        (phase === "upload" &&
          Boolean(
            recovery.saveState?.privateUploads?.length ||
            recovery.saveState?.privatePhotos?.length,
          )) ? (
          <>
            <Typography>
              {phase === "upload"
                ? "Проверка восстановит загрузку с прежним ключом и файлом. Публикация пока не сохраняется."
                : "Проверка вернёт сохранённую публикацию или завершит создание с прежним содержимым. Файлы повторно не загружаются."}
            </Typography>
            <Action onClick={onRecover}>Проверить сохранение</Action>
          </>
        ) : (
          <Typography>
            Проверьте публикацию в списке в отдельной вкладке. Загрузка и правка
            автоматически не повторяются.
          </Typography>
        )}
        <Action onClick={onDiscard}>
          Проверил список — удалить локальную копию
        </Action>
      </div>
    );
  return (
    <div role="status" className={classes.notice}>
      {recovery.autoRestored ? (
        <Typography>
          Незавершённый черновик восстановлен автоматически.
        </Typography>
      ) : null}
      <Typography>
        {recovery.savedAt
          ? "Черновик сохранён на этом устройстве"
          : "Сохраняем черновик…"}
      </Typography>
    </div>
  );
}
