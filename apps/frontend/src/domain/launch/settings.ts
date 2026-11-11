/** Парсеры настроек проверяют даты, ссылки и ревизии на границе API, прежде чем их использует интерфейс. */
import type {
  LaunchConfiguration,
  LaunchConfigurationSnapshot,
  Season,
  SeasonAppearance,
} from "@shared/launch-settings";
import { invalidResponse } from "@/shared/api/errors";

export const SEASONS: Season[] = ["winter", "spring", "summer", "autumn"];
export const SEASON_NAMES: Record<Season, string> = {
  winter: "Зима",
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
};
export type PublicAppearance = {
  revision: number;
  season: Season;
  appearance: SeasonAppearance;
};
export type ManagerOrderSettings = {
  revision: number;
  managerEmail: string;
  orderMethod: "email-client";
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalidResponse();
  return value as Record<string, unknown>;
}
function season(value: unknown): Season {
  if (!SEASONS.includes(value as Season)) throw invalidResponse();
  return value as Season;
}
export function validAnnualDate(value: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`2001-${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(5, 10) === value
  );
}
export function validSeasonUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
/** Existing saved URLs remain readable; reject share pages when editing. */
export function isSeasonSharingPage(value: string | null): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
    return ["disk.yandex.ru", "disk.yandex.com", "yadi.sk"].includes(host);
  } catch {
    return false;
  }
}
function appearance(value: unknown): SeasonAppearance {
  const row = record(value);
  if (
    typeof row.startsOn !== "string" ||
    !validAnnualDate(row.startsOn) ||
    !validSeasonUrl(row.backgroundUrl) ||
    !validSeasonUrl(row.bannerUrl)
  )
    throw invalidResponse();
  return {
    startsOn: row.startsOn,
    backgroundUrl: row.backgroundUrl,
    bannerUrl: row.bannerUrl,
  };
}
function revision(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 2147483647
  )
    throw invalidResponse();
  return value as number;
}
export function parsePublicAppearance(value: unknown): PublicAppearance {
  const row = record(value);
  return {
    revision: revision(row.revision),
    season: season(row.season),
    appearance: appearance(row.appearance),
  };
}
export function parseManagerOrderSettings(
  value: unknown,
): ManagerOrderSettings {
  const row = record(value);
  if (
    row.orderMethod !== "email-client" ||
    typeof row.managerEmail !== "string" ||
    row.managerEmail.length > 320 ||
    !/^(?!\.)(?!.*\.\.)[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(
      row.managerEmail,
    )
  )
    throw invalidResponse();
  return {
    revision: revision(row.revision),
    managerEmail: row.managerEmail,
    orderMethod: row.orderMethod,
  };
}
export function parseLaunchSnapshot(
  value: unknown,
): LaunchConfigurationSnapshot {
  const row = record(value);
  const config = record(row.config);
  if (
    config.timezone !== "Europe/Moscow" ||
    !["fixed", "calendar"].includes(config.seasonMode as string) ||
    typeof config.managerEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.managerEmail)
  )
    throw invalidResponse();
  const source = record(config.seasons);
  const seasons = Object.fromEntries(
    SEASONS.map((key) => [key, appearance(source[key])]),
  ) as LaunchConfiguration["seasons"];
  if (new Set(SEASONS.map((key) => seasons[key].startsOn)).size !== 4)
    throw invalidResponse();
  return {
    revision: revision(row.revision),
    config: {
      timezone: "Europe/Moscow",
      seasonMode: config.seasonMode as LaunchConfiguration["seasonMode"],
      fixedSeason: season(config.fixedSeason),
      seasons,
      managerEmail: config.managerEmail,
    },
  };
}
export function sameLaunchConfiguration(
  a: LaunchConfiguration,
  b: LaunchConfiguration,
): boolean {
  return (
    JSON.stringify(parseLaunchSnapshot({ revision: 0, config: a }).config) ===
    JSON.stringify(parseLaunchSnapshot({ revision: 0, config: b }).config)
  );
}
/** The server owns season dates; the public client only rechecks at Moscow midnight. */
export function untilMoscowMidnight(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const number = (key: string) =>
    Number(parts.find((part) => part.type === key)?.value);
  const elapsed =
    ((number("hour") * 60 + number("minute")) * 60 + number("second")) * 1000 +
    date.getUTCMilliseconds();
  return 86_400_000 - elapsed;
}
