/** Проверяем сериализацию статуса, дат и форматирования локального черновика поста. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  serializePostDraft,
  type PostDraft,
} from "../apps/frontend/src/domain/post/draft";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

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

/** Даже корректная дата не разрешает отложенную публикацию в прошлом или прямо сейчас. */
it.each(["2026-10-03T08:59:59.999Z", "2026-10-03T09:00:00Z"])(
  "rejects a non-future schedule %s without changing the draft",
  (date) => {
    const scheduled = {
      ...draft,
      status: "scheduled" as const,
      scheduledAt: new Date(date),
    };
    expect(() => serializePostDraft(scheduled)).toThrow(
      "Выберите дату и время в будущем",
    );
    expect(scheduled.scheduledAt.toISOString()).toBe(
      new Date(date).toISOString(),
    );
  },
);
it("accepts the next future instant and keeps archive publication dates valid", () => {
  expect(
    serializePostDraft({
      ...draft,
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 1),
    }).scheduledAt,
  ).toBe("2026-10-03T09:00:00.001Z");
  expect(
    serializePostDraft({
      ...draft,
      status: "published",
      publishedAt: new Date("2020-01-01T10:00:00Z"),
    }).publishedAt,
  ).toBe("2020-01-01T10:00:00.000Z");
});
