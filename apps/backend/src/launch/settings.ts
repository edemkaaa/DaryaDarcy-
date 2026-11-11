/** Валидирует сезонное оформление, сохраняет ревизию с аудитом и вычисляет текущий сезон. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { LaunchConfiguration, LaunchConfigurationSnapshot, Season } from "../../../../packages/shared/src/launch-settings";
import { PUBLIC_CONTACT_EMAIL } from "../../../../packages/shared/src/contact";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  launchSettings,
  users,
  adminAuditLog,
  type User,
} from "../../../../packages/database/src/schema";

const seasonName = z.enum(["winter", "spring", "summer", "autumn"]);
const annualDate = z.string().regex(/^\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`2001-${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(5, 10) === value;
}, "Нужна ежегодная дата MM-DD (без 29 февраля)");
export const SEASON_IMAGE_SHARING_PAGE_MESSAGE = "Укажите прямую ссылку на изображение, а не страницу Яндекс Диска";
const assetUrl = z.string().max(2048).url().pipe(z.string().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Изображения должны использовать HTTPS").refine(value => {
  // Отсекаем известные HTML-страницы без серверного запроса по URL.
  // Прямая ссылка на изображение может быть без расширения, например signed CDN URL.
  const host = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  return !["disk.yandex.ru", "disk.yandex.com", "yadi.sk"].includes(host);
}, SEASON_IMAGE_SHARING_PAGE_MESSAGE)).nullable();
const appearance = z.object({ startsOn: annualDate, backgroundUrl: assetUrl, bannerUrl: assetUrl }).strict();
export const launchConfigurationSchema = z.object({
  timezone: z.literal("Europe/Moscow"), seasonMode: z.enum(["fixed", "calendar"]), fixedSeason: seasonName,
  seasons: z.object({ winter: appearance, spring: appearance, summer: appearance, autumn: appearance }).strict(),
  managerEmail: z.string().max(320).email().transform(value => value.trim().toLowerCase()),
}).strict().refine(config => new Set(Object.values(config.seasons).map(value => value.startsOn)).size === 4, "Даты начала сезонов должны отличаться");

export const defaultLaunchConfiguration: LaunchConfiguration = {
  timezone: "Europe/Moscow", seasonMode: "fixed", fixedSeason: "winter",
  seasons: {
    winter: { startsOn: "11-20", backgroundUrl: null, bannerUrl: null },
    spring: { startsOn: "03-20", backgroundUrl: null, bannerUrl: null },
    summer: { startsOn: "06-01", backgroundUrl: null, bannerUrl: null },
    autumn: { startsOn: "09-01", backgroundUrl: null, bannerUrl: null },
  },
  managerEmail: PUBLIC_CONTACT_EMAIL,
};
export async function getLaunchConfiguration(database: MySql2Database): Promise<LaunchConfigurationSnapshot> {
  const [saved] = await database.select().from(launchSettings).where(eq(launchSettings.id, 1));
  return saved ? { revision: saved.revision, config: saved.config } : { revision: 0, config: structuredClone(defaultLaunchConfiguration) };
}
export type LaunchSettingsActor = Pick<User, "id" | "openId" | "sessionVersion">;

/** Настройки, новая ревизия и запись аудита сохраняются атомарно. */
export async function saveLaunchConfiguration(
  database: MySql2Database,
  actor: LaunchSettingsActor,
  expectedRevision: number,
  input: unknown,
): Promise<LaunchConfigurationSnapshot> {
  const parsed = launchConfigurationSchema.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= 2147483647) {
    const sharingPage = !parsed.success && parsed.error.issues.some(issue => issue.message === SEASON_IMAGE_SHARING_PAGE_MESSAGE);
    throw new TRPCError({ code: "BAD_REQUEST", message: sharingPage ? SEASON_IMAGE_SHARING_PAGE_MESSAGE : "Некорректные настройки" });
  }
  const config = parsed.data;
  return database.transaction(async tx => {
    // Под блокировкой читаем текущую сессию и роль. Выход из аккаунта мог
    // завершиться между проверкой JWT и началом транзакции.
    const [current] = await tx
      .select({
        openId: users.openId,
        sessionVersion: users.sessionVersion,
        role: users.role,
        blockedAt: users.blockedAt,
      })
      .from(users)
      .where(eq(users.id, actor.id))
      .for("update");
    if (
      !current ||
      current.openId !== actor.openId ||
      current.sessionVersion !== actor.sessionVersion
    )
      throw new TRPCError({ code: "UNAUTHORIZED" });
    if (current.blockedAt || current.role !== "admin")
      throw new TRPCError({ code: "FORBIDDEN" });
    await tx.insert(launchSettings).ignore().values({ id: 1, config: defaultLaunchConfiguration });
    const [saved] = await tx.select().from(launchSettings).where(eq(launchSettings.id, 1)).for("update");
    if (saved.revision !== expectedRevision) throw new TRPCError({ code: "CONFLICT", message: "Настройки изменились. Обновите страницу" });
    const revision = saved.revision + 1;
    await tx
      .update(launchSettings)
      .set({ config, revision, updatedBy: actor.id })
      .where(eq(launchSettings.id, 1));
    await tx.insert(adminAuditLog).values({
      actorUserId: actor.id,
      action: "update_launch_settings",
      targetType: "launch_settings",
      targetId: 1,
      details: `revision:${revision}`,
    });
    return { revision, config };
  });
}
/** Календарное вычисление не меняет сохранённые настройки: фиксированный и автоматический режимы различаются явно. */
export function currentSeason(config: LaunchConfiguration, date = new Date()): Season {
  if (config.seasonMode === "fixed") return config.fixedSeason;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, month: "2-digit", day: "2-digit" }).formatToParts(date);
  const day = `${parts.find(part => part.type === "month")!.value}-${parts.find(part => part.type === "day")!.value}`;
  const ordered = (Object.keys(config.seasons) as Season[]).sort((a, b) => config.seasons[a].startsOn.localeCompare(config.seasons[b].startsOn));
  return ordered.filter(season => config.seasons[season].startsOn <= day).at(-1) ?? ordered[ordered.length - 1];
}
