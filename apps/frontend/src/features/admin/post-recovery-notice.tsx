"use client";
/** Предложение восстановления показывает фазу сохранения и явные действия над локальной копией поста. */
import { useEffect, useState } from "react";
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
  // Показывает точную фазу durable операции: восстановление загрузки не объявляется сохранением поста, а неизвестный update не повторяется.

  const retryNotBefore = Math.max(
    0,
    ...(recovery.saveState?.privateVideos ?? []).map(
      (video) => video.retryNotBefore ?? 0,
    ),
  );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    // Обновляет обратный отсчёт по максимальному retryNotBefore видео; по завершении задержки и закрытии формы интервал очищается.

    setNow(Date.now());
    if (retryNotBefore <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryNotBefore) window.clearInterval(timer);
    }, 200);
    return () => window.clearInterval(timer);
  }, [retryNotBefore]);
  const retrySeconds = Math.max(0, Math.ceil((retryNotBefore - now) / 1000));
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
            {retrySeconds > 0 ? (
              <Typography role="status">
                Сервер обрабатывает другую видеозагрузку. Повтор через{" "}
                {retrySeconds} с.
              </Typography>
            ) : null}
            <Action disabled={retrySeconds > 0} onClick={onRecover}>
              Проверить сохранение
            </Action>
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
