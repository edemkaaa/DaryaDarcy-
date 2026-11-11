/** Разделяем безопасную карточку VK и выдачу адреса плеера после проверки текущего доступа. */
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import {
  videos,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { parseVkEmbed, type VkVideoInput } from "./vk-video-input";
import { publicCatalogThumbnail } from "./video-thumbnail";
import { userHasClubAccess } from "../identity/club-access";
import { getActiveClubSubscription } from "../db";

/** Отключённая возможность каталога не становится доступной от одного наличия маршрута. */
export function requireVkCatalogEnabled() {
  if (process.env.VK_CATALOG_ENABLED !== "true")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Раздел видео временно недоступен",
    });
}
type Reader = Pick<MySql2Database, "select" | "execute">;
/** Проверяем наличие ожидаемой схемы без применения runtime-миграций. */
export async function requireVkCatalogSchema(tx: Reader) {
  await tx.select().from(videos).limit(0);
  const [result] = await tx.execute(sql`
    SELECT s.INDEX_NAME AS name,s.COLUMN_NAME AS columnName,s.SEQ_IN_INDEX AS position,t.ENGINE AS engine
    FROM information_schema.STATISTICS s JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='videos' AND s.NON_UNIQUE=0`);
  const rows: unknown = result;
  if (
    !Array.isArray(rows) ||
    !rows.some(
      (row) =>
        row.columnName === "vkSourceKey" &&
        row.position === 1 &&
        row.engine === "InnoDB" &&
        rows.filter((other) => other.name === row.name).length === 1,
    )
  )
    throw new Error("Video schema unavailable");
}
/** Заново проверяем автора перед административной операцией с видео. */
export async function currentVideoActor(tx: Reader, actor: User) {
  const [current] = await tx
    .select()
    .from(users)
    .where(eq(users.id, actor.id))
    .for("update");
  if (!current || current.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (current.blockedAt || current.accountDeletionRequestedAt)
    throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}
/** Сохраняем проверенный VK-источник и публичную обложку с контролем ревизии. */
/** Под текущей админской сессией сохраняем разобранный VK-источник: правка сверяет ревизию и уникальность, повтор создания не меняет победившую запись и допускается лишь при полном совпадении данных. */
export async function upsertVkVideo(actor: User, input: VkVideoInput) {
  requireVkCatalogEnabled();
  const source = parseVkEmbed(input.embedUrl);
  if (!source) throw new TRPCError({ code: "BAD_REQUEST" });
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async (tx) => {
    const current = await currentVideoActor(tx, actor);
    if (current.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await requireVkCatalogSchema(tx);
    const data = {
      provider: "vk" as const,
      youtubeId: null,
      vkEmbedUrl: source.embedUrl,
      vkSourceKey: source.sourceKey,
      title: input.title,
      access: input.access,
      published: input.published,
      ...(input.thumbnailUrl === undefined
        ? {}
        : { thumbnailUrl: input.thumbnailUrl }),
    };
    if (input.id !== undefined) {
      const strict = process.env.CONTENT_EDIT_REVISIONS_REQUIRED;
      if (strict !== undefined && strict !== "true" && strict !== "false")
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      if (input.expectedRevision === undefined && strict === "true")
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Загрузите актуальную версию видео" });
      const [existing] = await tx
        .select()
        .from(videos)
        .where(eq(videos.id, input.id))
        .for("update");
      if (!existing || existing.provider !== "vk")
        throw new TRPCError({ code: "NOT_FOUND" });
      if (input.expectedRevision !== undefined && input.expectedRevision !== existing.editRevision)
        throw new TRPCError({ code: "CONFLICT", message: "Видео уже изменено. Сверьте актуальную версию" });
      const [duplicate] = await tx
        .select({ id: videos.id })
        .from(videos)
        .where(eq(videos.vkSourceKey, source.sourceKey));
      if (duplicate && duplicate.id !== input.id)
        throw new TRPCError({ code: "CONFLICT" });
      await tx.update(videos).set({ ...data, editRevision: sql`${videos.editRevision} + 1` }).where(eq(videos.id, input.id));
      return { id: input.id };
    }
// Уникальный vkSourceKey захватывается без перезаписи существующей карточки; ниже проверяется равенство принятого намерения.
    await tx
      .insert(videos)
      .values(data)
      .onDuplicateKeyUpdate({
        set: {
          vkSourceKey: sql`${videos.vkSourceKey}`,
          updatedAt: sql`${videos.updatedAt}`,
        },
      });
    const [saved] = await tx
      .select()
      .from(videos)
      .where(eq(videos.vkSourceKey, source.sourceKey))
      .for("update");
    if (!saved) throw new Error("Invalid video write");
    if (
      saved.provider !== data.provider ||
      saved.youtubeId !== null ||
      saved.vkEmbedUrl !== data.vkEmbedUrl ||
      saved.title !== data.title ||
      saved.access !== data.access ||
      saved.published !== data.published ||
      saved.thumbnailUrl !== (input.thumbnailUrl ?? null)
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "Ролик уже существует с другими данными",
      });
    return { id: saved.id };
  });
}

/** Полные детали источника выдаются административному редактору после проверки автора. */
export async function adminVkVideoDetail(actor: User, id: number) {
  requireVkCatalogEnabled();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async tx => {
    const current = await currentVideoActor(tx, actor);
    if (current.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const [video] = await tx.select().from(videos).where(eq(videos.id, id));
    if (!video || video.provider !== "vk") throw new TRPCError({ code: "NOT_FOUND" });
    return { id: video.id, title: video.title, embedUrl: video.vkEmbedUrl, access: video.access, published: video.published, thumbnailUrl: video.thumbnailUrl, editRevision: video.editRevision };
  });
}

/** Карточка каталога сообщает доступность; закрытый адрес плеера выдаётся отдельным запросом. */
/** Постранично читаем опубликованные карточки по возрастающему ID, вычисляем canWatch из текущего доступа и при явном запросе фильтруем публичные обложки; embedUrl в карточку не попадает. */
export async function videoCatalog(
  actor: User | null,
  input: { limit: number; cursor?: number; includeThumbnails?: boolean },
) {
  requireVkCatalogEnabled();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async (tx) => {
    const current = actor ? await currentVideoActor(tx, actor) : null;
    await requireVkCatalogSchema(tx);
    const canWatchClub = current
      ? await userHasClubAccess(current, (id) =>
          getActiveClubSubscription(id, tx),
        )
      : false;
    const rows = await tx
      .select({
        id: videos.id,
        title: videos.title,
        duration: videos.duration,
        access: videos.access,
        ...(input.includeThumbnails
          ? { thumbnailUrl: videos.thumbnailUrl }
          : {}),
      })
      .from(videos)
      .where(
        and(
          eq(videos.published, true),
          input.cursor ? gt(videos.id, input.cursor) : undefined,
        ),
      )
      .orderBy(asc(videos.id))
      .limit(input.limit + 1);
    const items = rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      title: row.title.normalize("NFC"),
      duration: row.duration,
      access: row.access,
      canWatch: row.access === "public" || canWatchClub,
      ...(input.includeThumbnails
        ? { thumbnailUrl: publicCatalogThumbnail(row.thumbnailUrl ?? null) }
        : {}),
    }));
    return {
      items,
      nextCursor: rows.length > input.limit ? items.at(-1)!.id : null,
    };
  });
}
/** Перед возвратом embedUrl повторно проверяем право текущего зрителя. */
/** Блокируем опубликованное видео, повторно проверяем сессию и клубный доступ, затем сверяем согласованность полей провайдера перед выдачей адреса плеера. */
export async function videoPlayback(actor: User | null, id: number) {
  requireVkCatalogEnabled();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async (tx) => {
    const current = actor ? await currentVideoActor(tx, actor) : null;
    await requireVkCatalogSchema(tx);
    const [video] = await tx
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.published, true)))
      .for("update");
    if (!video) throw new TRPCError({ code: "NOT_FOUND" });
    if (video.access === "club") {
      if (!current) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (
        !(await userHasClubAccess(current, (userId) =>
          getActiveClubSubscription(userId, tx),
        ))
      )
        throw new TRPCError({ code: "FORBIDDEN" });
    } else if (video.access !== "public")
      throw new Error("Invalid video access");
    if (video.provider === "vk") {
      const source = video.vkEmbedUrl ? parseVkEmbed(video.vkEmbedUrl) : null;
      if (
        !source ||
        source.sourceKey !== video.vkSourceKey ||
        video.youtubeId !== null ||
        video.videoUrl !== null
      )
        throw new Error("Invalid VK source");
      return {
        id: video.id,
        provider: "vk" as const,
        embedUrl: source.embedUrl,
      };
    }
    if (
      video.provider !== "youtube" ||
      !video.youtubeId ||
      !/^[\w-]{11}$/.test(video.youtubeId) ||
      video.vkEmbedUrl !== null ||
      video.vkSourceKey !== null
    )
      throw new Error("Invalid YouTube source");
    return {
      id: video.id,
      provider: "youtube" as const,
      youtubeId: video.youtubeId,
      videoUrl: video.videoUrl,
    };
  });
}
