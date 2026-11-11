/** Проверяем форму квитанции публичной обложки и разделение незавершённого draft от финального create намерения. */
import { expect, it } from "vitest";
import { requirePublicCoverReceipt } from "../apps/frontend/src/domain/content/article-cover-journal";
import {
  articleDraftSchema,
  parseArticleCreationRecord,
} from "../apps/frontend/src/domain/content/article-creation-journal";
/** Небезопасный URL, неполный ответ и аватарные признаки не подтверждают обложку статьи. */
it.each([
  {
    state: "ready",
    url: "javascript:alert(1)",
    avatarApplied: false,
    isCurrent: null,
  },
  {
    state: "ready",
    url: "https://example.test/cover.jpg",
    avatarApplied: true,
    isCurrent: null,
  },
  {
    state: "ready",
    url: "https://example.test/cover.jpg",
    avatarApplied: false,
    isCurrent: true,
  },
  { state: "ready", url: "https://example.test/cover.jpg" },
  { state: "pending", url: "https://example.test/cover.jpg" },
  null,
])("rejects a malformed or avatar-specific cover receipt: %j", (value) => {
  expect(() => requirePublicCoverReceipt(value)).toThrow();
});
/** Состояния missing/pending и корректный cover-ready сохраняются без выдуманного успеха. */
it.each([
  { state: "missing" },
  { state: "pending" },
  {
    state: "ready",
    url: "https://example.test/cover.jpg",
    avatarApplied: false,
    isCurrent: null,
  },
])("accepts the explicit cover contract: %j", (value) => {
  expect(requirePublicCoverReceipt(value)).toEqual(value);
});
/** Пустой заголовок допустим для локального draft загрузки; финальный create snapshot остаётся строгим. */
it("a cover snapshot can preserve an unfinished title without weakening article write validation", () => {
  const draft = {
    title: "",
    coverUrl: null,
    access: "club",
    published: false,
    sections: [{ type: "text", text: "unfinished" }],
  };
  expect(articleDraftSchema.parse(draft)).toEqual(draft);
  expect(() =>
    parseArticleCreationRecord(
      {
        version: 1,
        ownerId: 101,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        payload: draft,
      },
      101,
    ),
  ).toThrow();
});
