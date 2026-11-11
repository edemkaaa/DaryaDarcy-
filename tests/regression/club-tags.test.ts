/** Проверяем связь клубных рубрик с окном комментариев и выбором внутренней вкладки. */
import { describe, expect, it } from "vitest";
import {
  areCommentsOpen,
  commentsCloseAt,
  isCommunityPost,
  primaryClubTab,
} from "../../packages/shared/src/club-tags";

/** Все проверки используют серверные правила тегов; визуальная подпись рубрики не определяет доступ к обсуждению. */
describe("club-tags comments", () => {
  /** Свежая дата сама по себе не открывает обсуждение: нужен также тег комьюнити. */
  it("opens comments only for community posts within 48h", () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isCommunityPost(["community"])).toBe(true);
    expect(areCommentsOpen(["community"], recent)).toBe(true);
    expect(areCommentsOpen(["life"], recent)).toBe(false);
  });

  /** Фиксируем закрытие после 48 часов и совместимость русского названия тега. */
  it("closes comments after 48 hours", () => {
    const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
    expect(areCommentsOpen(["комьюнити"], old)).toBe(false);
  });

  /** Считаем срок от абсолютного момента публикации, сохраняя смещение часового пояса входной даты. */
  it("computes close time from publishedAt", () => {
    const published = new Date("2026-09-10T10:00:00+03:00");
    const until = commentsCloseAt(published);
    expect(until?.getTime()).toBe(published.getTime() + 48 * 60 * 60 * 1000);
  });

  /** При нескольких рубриках проверяем приоритет вкладки комьюнити. */
  it("routes community tag to community tab", () => {
    expect(primaryClubTab(["community", "life"])).toBe("community");
  });
});
