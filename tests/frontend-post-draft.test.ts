/** Проверяем сериализацию статуса, дат и форматирования локального черновика поста. */
import { expect, it } from "vitest";
import {
  serializePostDraft,
  type PostDraft,
} from "../apps/frontend/src/domain/post/draft";

const draft: PostDraft = {
  text: "Тестовая публикация",
  photos: [],
  videos: [],
  tags: [],
  status: "draft",
  target: "feed",
  scheduledAt: null,
  publishedAt: new Date("2026-10-03T09:00:00Z"),
  sortOrder: 0,
};
/** Черновик не становится published от наличия даты; транспорт получает ISO-значение. */
it("keeps a draft unpublished and serializes its date", () => {
  expect(serializePostDraft(draft)).toMatchObject({
    published: false,
    status: "draft",
    publishedAt: "2026-10-03T09:00:00.000Z",
    scheduledAt: null,
  });
});
/** Отложенная публикация требует существующую корректную дату. */
it("requires a valid date before scheduling a publication", () => {
  expect(() => serializePostDraft({ ...draft, status: "scheduled" })).toThrow(
    "Выберите дату",
  );
  expect(() =>
    serializePostDraft({
      ...draft,
      status: "scheduled",
      scheduledAt: new Date("invalid"),
    }),
  ).toThrow("Выберите дату");
});
/** Scheduled сохраняет дату расписания и очищает дату немедленной публикации. */
it("serializes a schedule without publishing immediately", () => {
  expect(
    serializePostDraft({
      ...draft,
      status: "scheduled",
      scheduledAt: new Date("2026-10-04T09:00:00Z"),
    }),
  ).toMatchObject({
    published: false,
    publishedAt: null,
    scheduledAt: "2026-10-04T09:00:00.000Z",
  });
});

/** Два независимых URL и выделения сохраняются после повторной сериализации одного payload. */
it("preserves two independent links and combined bold/italic formatting through serialization", () => {
  const richText = [
    {
      type: "paragraph" as const,
      children: [
        { text: "Первый", link: "https://example.test/one", bold: true },
        { text: " и " },
        { text: "второй", link: "https://example.test/two", italic: true },
      ],
    },
  ];
  const saved = serializePostDraft({
    ...draft,
    text: "Первый и второй",
    richText,
  });
  expect(saved.richText).toEqual(richText);
  expect(
    serializePostDraft({ ...draft, text: saved.text, richText: saved.richText })
      .richText,
  ).toEqual(richText);
});
