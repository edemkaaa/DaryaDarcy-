import { describe, expect, it } from "vitest";
import {
  parseLaunchSnapshot,
  parsePublicAppearance,
  untilMoscowMidnight,
  validAnnualDate,
  validSeasonUrl,
} from "../apps/frontend/src/domain/launch/settings";

const appearance = { startsOn: "11-20", backgroundUrl: null, bannerUrl: null };
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
describe("season configuration boundary", () => {
  it.each(["01-01", "02-28", "03-20", "06-01", "09-01", "11-20", "12-31"])(
    "accepts annual date %s",
    (value) => expect(validAnnualDate(value)).toBe(true),
  );
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
  it.each([
    null,
    "https://assets.example.test/image.webp",
    "https://assets.example.test/image.webp?rev=2",
  ])("accepts configured image %s", (value) =>
    expect(validSeasonUrl(value)).toBe(true),
  );
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
  it("uses the server season rather than inferring it from the appearance start date", () => {
    expect(
      parsePublicAppearance({ revision: 7, season: "summer", appearance }),
    ).toEqual({ revision: 7, season: "summer", appearance });
  });
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
  it("preserves all four seasons and the unrelated manager email", () =>
    expect(parseLaunchSnapshot(snapshot())).toEqual(snapshot()));
  it("rejects duplicate start dates", () => {
    const value = snapshot();
    value.config.seasons.spring.startsOn = "11-20";
    expect(() => parseLaunchSnapshot(value)).toThrow();
  });
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
