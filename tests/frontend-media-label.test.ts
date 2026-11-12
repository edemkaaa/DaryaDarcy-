import { expect, it } from "vitest";
import * as frontend from "../apps/frontend/src/shared/media/media-label";
import * as shared from "../packages/shared/src/media-label";

it("uses the shared functions for every frontend caller", () => {
  expect(frontend.isRawMediaFilename).toBe(shared.isRawMediaFilename);
  expect(frontend.friendlyMediaName).toBe(shared.friendlyMediaName);
  expect(frontend.displayPostTitle).toBe(shared.displayPostTitle);
});

it.each([
  ["IMG_1234.mp4", "video", null],
  ["VID-1234.mp4", "video", null],
  ["", "audio", "Аудио"],
  [null, "document", "Документ"],
  ["/uploads/Мой фильм.mp4", "video", "Мой фильм"],
  ["C:\\uploads\\Выкройка.pdf", "document", "Выкройка"],
  ["  Песня.mp3  ", "audio", "Песня"],
] as const)("keeps the attachment label for %s", (name, type, expected) => {
  expect(frontend.friendlyMediaName(name, type)).toBe(expected);
});

it.each([
  [undefined, "Запись клуба"],
  ["IMG_1234.jpg\n\nЧеловеческий заголовок", "Человеческий заголовок"],
  ["  Первая строка  \nВторая строка", "Первая строка"],
  ["Я".repeat(100), "Я".repeat(80)],
] as const)("keeps the publication title for %s", (text, expected) => {
  expect(frontend.displayPostTitle(text)).toBe(expected);
});
