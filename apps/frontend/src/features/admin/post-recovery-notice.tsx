"use client";
/** Предложение восстановления показывает фазу сохранения и явные действия над локальной копией поста. */
import { useEffect, useState } from "react";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
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
  const notice: Parameters<typeof useBackgroundNotice>[0] = {
    when: true,
    message: "",
    priority: -1,
    busy,
  };
  const discard = {
    id: "discard-post-recovery",
    label: "Удалить локальную копию",
    disabled: busy,
    onClick: onDiscard,
  };
  const phase = recovery.saveState?.phase;
  if (recovery.status === "loading") {
    notice.message = "Проверяем сохранённый черновик…";
  } else if (recovery.status === "offered") {
    notice.message = "На этом устройстве есть незавершённая публикация.";
    notice.priority = 10;
    notice.actions = [
      {
        id: "restore-post-draft",
        label: "Восстановить черновик",
        disabled: busy,
        onClick: recovery.restore,
      },
      { ...discard, label: "Удалить локальную копию" },
    ];
  } else if (recovery.status === "error") {
    notice.message = recovery.error ?? "Не удалось прочитать черновик.";
    notice.tone = "error";
    notice.priority = 10;
    notice.actions = [
      {
        id: "retry-draft-storage",
        label: "Повторить сохранение черновика",
        disabled: busy,
        onClick: () => recovery.retryStorage().catch(() => {}),
      },
      discard,
    ];
  } else if (phase === "complete") {
    notice.message = `Публикация №${recovery.saveState?.savedId} сохранена.`;
    notice.tone = "success";
    notice.priority = 10;
    notice.actions = [
      {
        id: "finish-post-recovery",
        label: "Завершить восстановление",
        disabled: busy,
        onClick: onFinish,
      },
    ];
  } else if (phase && phase !== "idle" && !busy) {
    const canRecover =
      phase === "create" ||
      (phase === "upload" &&
        Boolean(
          recovery.saveState?.privateUploads?.length ||
          recovery.saveState?.privatePhotos?.length ||
          recovery.saveState?.privateVideos?.length,
        ));
    notice.message =
      "Результат предыдущего сохранения не подтверждён. Новая отправка заблокирована.\n" +
      (canRecover
        ? phase === "upload"
          ? "Проверка восстановит загрузку файлов. Публикация пока не сохраняется."
          : "Проверка завершит прежнюю попытку. Файлы повторно не загружаются."
        : "Проверьте публикацию в списке в отдельной вкладке. Загрузка и правка автоматически не повторяются.");
    if (retrySeconds > 0)
      notice.message += `\nПовтор доступен через ${retrySeconds} сек.`;
    notice.tone = "error";
    notice.priority = 10;
    notice.actions = [
      ...(canRecover
        ? [
            {
              id: "check-post-save",
              label: "Проверить сохранение",
              disabled: retrySeconds > 0,
              onClick: onRecover,
            },
          ]
        : []),
      discard,
    ];
  } else {
    notice.message =
      (recovery.autoRestored
        ? "Незавершённый черновик восстановлен автоматически.\n"
        : "") +
      (recovery.savedAt
        ? "Черновик сохранён на этом устройстве"
        : "Сохраняем черновик…");
  }
  useBackgroundNotice(notice);
  return null;
}
