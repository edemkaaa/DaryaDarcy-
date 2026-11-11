/** SSR-подсказка редактора проверяется на синтетическом состоянии незавершённой загрузки. */
import { expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PostRecoveryNotice } from "../apps/frontend/src/features/admin/post-recovery-notice";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";

/** Собираем coordinator snapshot и File в памяти, без upload/HTTP; возвращаем статическую разметку уведомления. */
function notice(phase: "upload" | "update", video = true) {
  const recovery: ComponentProps<typeof PostRecoveryNotice>["recovery"] = {
    status: "ready",
    error: null,
    savedAt: 1,
    record: null,
    autoRestored: false,
    saveState: {
      ...new PostSaveCoordinator().snapshot(),
      phase,
      privateVideos: video
        ? [
            {
              key: "private-video-original-key",
              file: new File(["video"], "lesson.mp4", { type: "video/mp4" }),
              attempted: true,
            },
          ]
        : [],
    },
    blocked: true,
    checkpoint: async () => {},
    restore() {},
    clear: async () => {},
    retryStorage: async () => {},
  };
  return renderToStaticMarkup(
    createElement(PostRecoveryNotice, {
      recovery,
      busy: false,
      onRecover() {},
      onFinish() {},
      onDiscard() {},
    }),
  );
}
/** Неопределённая приватная video-загрузка предлагает сначала проверить статус, а не создать пост заново. */
it("offers status-first recovery for a video-only uncertain upload", () => {
  const markup = notice("upload");
  expect(markup).toContain("Проверить сохранение");
  expect(markup).toContain("Публикация пока не сохраняется");
});
/** Наличие video receipt не разрешает слепо повторять неизвестный update поста. */
it("does not offer replay for an unknown post update, even with a private video", () => {
  expect(notice("update")).not.toContain("Проверить сохранение");
});
/** Без сохранённого приватного намерения кнопка восстановления не обещает недоступный status-path. */
it("keeps the legacy upload warning without a recoverable private intent", () => {
  expect(notice("upload", false)).not.toContain("Проверить сохранение");
});
