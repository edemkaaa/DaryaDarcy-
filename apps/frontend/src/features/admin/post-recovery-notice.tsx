"use client";
import { Typography } from "@/shared/ui/elements";
import {
  StatusNotice,
  StatusNoticeAction as Action,
} from "@/shared/ui/status-notice";
import type { usePostRecovery } from "./use-post-recovery";

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
    return <StatusNotice>Проверяем сохранённый черновик…</StatusNotice>;
  if (recovery.status === "offered")
    return (
      <StatusNotice>
        <Typography>
          На этом устройстве есть незавершённая публикация.
        </Typography>
        <Action onClick={recovery.restore}>Восстановить черновик</Action>
        <Action onClick={onDiscard}>Удалить локальную копию</Action>
      </StatusNotice>
    );
  if (recovery.status === "error")
    return (
      <StatusNotice tone="error">
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
      </StatusNotice>
    );
  const phase = recovery.saveState?.phase;
  if (phase === "complete")
    return (
      <StatusNotice tone="success">
        <Typography>
          Публикация №{recovery.saveState?.savedId} сохранена.
        </Typography>
        <Action disabled={busy} onClick={onFinish}>
          Завершить восстановление
        </Action>
      </StatusNotice>
    );
  if (phase && phase !== "idle" && !busy)
    return (
      <StatusNotice tone="error">
        <Typography>
          Результат предыдущего сохранения не подтверждён. Новая отправка
          заблокирована.
        </Typography>
        {phase === "create" ||
        (phase === "upload" &&
          Boolean(
            recovery.saveState?.privateUploads?.length ||
            recovery.saveState?.privatePhotos?.length ||
            recovery.saveState?.privateVideos?.length,
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
      </StatusNotice>
    );
  return (
    <StatusNotice>
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
    </StatusNotice>
  );
}
