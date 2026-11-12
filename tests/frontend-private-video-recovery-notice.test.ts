/** Регистрация уведомления проверяется на синтетическом состоянии незавершённой загрузки. */
import { expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PostRecoveryNotice } from "../apps/frontend/src/features/admin/post-recovery-notice";
import { useBackgroundNotice } from "../apps/frontend/src/shared/ui/background-notice";
vi.mock("../apps/frontend/src/shared/ui/background-notice", () => ({
  useBackgroundNotice: vi.fn(),
}));
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";

/** Собираем coordinator snapshot и File в памяти, без upload/HTTP; возвращаем сообщение и доступные действия. */
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
  renderToStaticMarkup(
    createElement(PostRecoveryNotice, {
      recovery,
      busy: false,
      onRecover() {},
      onFinish() {},
      onDiscard() {},
    }),
  );
  return vi.mocked(useBackgroundNotice).mock.calls.at(-1)![0];
}
/** Неопределённая приватная video-загрузка предлагает сначала проверить статус, а не создать пост заново. */
it("offers status-first recovery for a video-only uncertain upload", () => {
  const markup = notice("upload");
  expect(markup.actions?.map((action) => action.label)).toContain(
    "Проверить сохранение",
  );
  expect(markup.message).toContain("Публикация пока не сохраняется");
});
/** Наличие video receipt не разрешает слепо повторять неизвестный update поста. */
it("does not offer replay for an unknown post update, even with a private video", () => {
  expect(notice("update").actions?.map((action) => action.label)).not.toContain(
    "Проверить сохранение",
  );
});
/** Без сохранённого приватного намерения кнопка восстановления не обещает недоступный status-path. */
it("keeps the legacy upload warning without a recoverable private intent", () => {
  expect(
    notice("upload", false).actions?.map((action) => action.label),
  ).not.toContain("Проверить сохранение");
});
