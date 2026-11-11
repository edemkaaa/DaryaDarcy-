/** Клиентская граница сезонных snapshot валидирует даты/URL/ревизии и считает следующую московскую полночь. */
import { describe, expect, it } from "vitest";
import {
  parseLaunchSnapshot,
  parsePublicAppearance,
  untilMoscowMidnight,
  validAnnualDate,
  validSeasonUrl,
} from "../apps/frontend/src/domain/launch/settings";

const appearance = { startsOn: "11-20", backgroundUrl: null, bannerUrl: null };
/** Создаём полный синтетический снимок четырёх сезонов с отдельным manager email. */
const snapshot = () => ({
  revision: 7,
  config: {
    timezone: "Europe/Moscow",
    seasonMode: "calendar",
    fixedSeason: "winter",
    managerEmail: "manager@example.test",
    seasons: {
      winter: appearance,
      spring: { ...appearance, startsOn: "03-20" },
      summer: { ...appearance, startsOn: "06-01" },
      autumn: { ...appearance, startsOn: "09-01" },
    },
  },
});
/** Проверки не сохраняют настройки и не запрашивают картинки; это контракт данных и времени. */
describe("season configuration boundary", () => {
  /** Допускаем MM-DD обычного невисокосного календаря. */
  it.each(["01-01", "02-28", "03-20", "06-01", "09-01", "11-20", "12-31"])(
    "accepts annual date %s",
    (value) => expect(validAnnualDate(value)).toBe(true),
  );
  /** Невозможные даты, 29 февраля и другой формат не нормализуются молча. */
  it.each([
    "02-29",
    "02-30",
    "04-31",
    "00-12",
    "13-01",
    "1-01",
    "2026-11-20",
    "11-00",
  ])("rejects annual date %s", (value) =>
    expect(validAnnualDate(value)).toBe(false),
  );
  /** Null означает встроенное оформление; прямой HTTPS с query разрешён. */
  it.each([
    null,
    "https://assets.example.test/image.webp",
    "https://assets.example.test/image.webp?rev=2",
  ])("accepts configured image %s", (value) =>
    expect(validSeasonUrl(value)).toBe(true),
  );
  /** HTTP, scripts, credentials, relative и чрезмерно длинные URL отвергаются. */
  it.each([
    undefined,
    "",
    "http://assets.example.test/image.webp",
    "javascript:alert(1)",
    "/image.webp",
    "https://user:secret@assets.example.test/image.webp",
    "https://assets.example.test/" + "x".repeat(2048),
  ])("rejects unsafe or malformed image %s", (value) =>
    expect(validSeasonUrl(value)).toBe(false),
  );
  /** Клиент доверяет проверенному season из API, не угадывая его по startsOn. */
  it("uses the server season rather than inferring it from the appearance start date", () => {
    expect(
      parsePublicAppearance({ revision: 7, season: "summer", appearance }),
    ).toEqual({ revision: 7, season: "summer", appearance });
  });
  /** Public snapshot требует известный сезон, целую неотрицательную ревизию и валидное оформление. */
  it.each([
    undefined,
    {},
    { revision: -1, season: "winter", appearance },
    { revision: 1.5, season: "winter", appearance },
    { revision: 0, season: "monsoon", appearance },
    {
      revision: 0,
      season: "winter",
      appearance: { ...appearance, startsOn: "02-29" },
    },
  ])("rejects malformed public snapshot %#", (value) =>
    expect(() => parsePublicAppearance(value)).toThrow(),
  );
  /** Полный parse не теряет соседнюю почтовую настройку. */
  it("preserves all four seasons and the unrelated manager email", () =>
    expect(parseLaunchSnapshot(snapshot())).toEqual(snapshot()));
  /** Два сезона не могут начинаться в один MM-DD. */
  it("rejects duplicate start dates", () => {
    const value = snapshot();
    value.config.seasons.spring.startsOn = "11-20";
    expect(() => parseLaunchSnapshot(value)).toThrow();
  });
  /** Неполная конфигурация и UTC вместо Moscow отклоняются. */
  it("rejects a missing season and a different time zone", () => {
    const value = snapshot();
    expect(() =>
      parseLaunchSnapshot({
        ...value,
        config: { ...value.config, seasons: { winter: appearance } },
      }),
    ).toThrow();
    expect(() =>
      parseLaunchSnapshot({
        ...value,
        config: { ...value.config, timezone: "UTC" },
      }),
    ).toThrow();
  });
  /** Проверяем остаток дня в UTC+3, включая точную границу и Новый год. */
  it.each([
    ["2026-11-19T20:59:59.750Z", 250],
    ["2026-11-19T21:00:00.000Z", 86400000],
    ["2026-12-31T20:59:59.000Z", 1000],
    ["2026-03-19T20:59:00.000Z", 60000],
    ["2026-06-01T00:00:00.000Z", 21 * 3600000],
  ])("schedules a Moscow day boundary for %s", (time, delay) =>
    expect(untilMoscowMidnight(new Date(time))).toBe(delay),
  );
});
