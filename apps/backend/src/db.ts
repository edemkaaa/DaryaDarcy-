/** Совместимый фасад старых вызовов. Владение пулом и доменные правила остаются в отдельных модулях. */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { getDb } from "./database/connection";
export { getDb, closeDb } from "./database/connection";
import { readActiveClubSubscription } from "./billing/subscription-reader";
import { settleClubOrder } from "./billing/settlement";
import { grantClubAccess } from "./billing/grants";
import { membersPage, type membersPageInput } from "./admin/members-page";
import { paymentsPage, type paymentsPageInput } from "./admin/payments-page";
import type { ClubTabId } from "../../../packages/shared/src/club-tags";
import {
  listAdminMembers as readAdminMembers,
  listAdminPayments as readAdminPayments,
} from "./admin/membership-repository";
import { confirmPostPublication, type PostPublication } from "./content/publication";
import { publishDueScheduledPosts as persistDueScheduledPosts } from "./content/scheduled-publication";
import { savePostEdit as persistPostEdit } from "./content/post-editor";
import type { ContentEditPrecondition } from "./content/content-edit-revision";
import { deletePost as persistPostDeletion } from "./content/post-deletion";
import { assertContentWriteActor, type ContentWriteActor } from "./content/content-write-actor";
import {
  getPostMediaByPostId as readPostMediaByPostId,
} from "./content/post-media-repository";
import {
  getPostById as readPostDetail,
  getLatestPublishedPost as readLatestPublishedPost,
} from "./content/post-detail-repository";
import {
  getAllTags as readAllTags,
  getPosts as readPosts,
  getPostsPaginated as readPostPage,
  getPostsByIds as readPostsByIds,
  getPostsForTarget as readTargetPosts,
} from "./content/post-catalog-repository";
import {
  getAllPostsAdmin as readAllAdminPosts,
  getAdminPostsFiltered as readAdminPostsFiltered,
  getScheduledPosts as readScheduledPosts,
  getPostStatistics as readPostStatistics,
} from "./content/post-admin-repository";
import { getAdminPostsPage as readAdminPostsPage, getAdminPostDetail as readAdminPostDetail, getAdminPostCounts as readAdminPostCounts, getAdminPostCalendar as readAdminPostCalendar, type adminPostsPageInput, type adminPostCalendarInput } from "./content/admin-post-reads";
import type { z } from "zod";
import {
  getVideos as readVideos,
  isPublicYoutubeVideo as readPublicYoutubeVideo,
  getVideoById as readVideoById,
  getVideoByYoutubeId as readVideoByYoutubeId,
  createVideo as persistVideoCreation,
  bulkImportVideos as persistVideoImport,
  updateVideo as persistVideoUpdate,
  deleteVideo as persistVideoDeletion,
  type PublicVideo,
} from "./content/video-repository";
import {
  listPublishedArticles as readPublishedArticles,
  listPublishedArticleCards as readPublishedArticleCards,
  listAllArticles as readAllArticles,
  getArticleById as readArticleById,
  getAdminArticleDetail as readAdminArticleDetail,
} from "./content/article-repository";
import {
  createArticle as persistArticleCreation,
  updateArticle as persistArticleUpdate,
  deleteArticle as persistArticleDeletion,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "./content/article-writes";
import {
  createPostWithVideos as persistNewPost,
  createPostOnce as persistPostOnce,
} from "./content/post-creator";
import type { PostCreationIntent } from "./content/post-creation-request";
import type { ArticleCreationIntent } from "./content/article-creation-request";
import { articleCreationStatus as readArticleCreationStatus } from "./content/article-creation-request";
import type { PostAttachmentChanges } from "./content/post-attachments";
import {
  togglePostReaction,
  type ReactionAccessCheck,
  getUserLikedPostIds as readUserLikedPostIds,
  getUserSavedPostIds as readUserSavedPostIds,
} from "./content/post-reactions";
import {
  MARKETING_PUSH_CONSENT_VERSION,
  type PushConsentStatus,
  type PushConsentType,
} from "../../../packages/shared/src/push-consent";
import {
  InsertUser,
  User,
  users,
  pushTokens,
  pushConsentEvents,
  postMedia,
  InsertPostMedia,
  PostMedia,
} from "../../../packages/database/src/schema";
import { normalizeEmail } from "./_core/password";

/** Выводим детерминированную email-идентичность из нормализованного адреса для согласования регистрации и оплаты без перезаписи чужой записи. */
export function emailToOpenId(email: string): string {
  const hash = createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 40);
  return `e_${hash}`;
}

/** Выводим отдельную детерминированную SMS-идентичность из уже нормализованного номера. */
export function phoneToOpenId(phone: string): string {
  const hash = createHash("sha256").update(phone).digest("hex").slice(0, 40);
  return `p_${hash}`;
}

/** Признаём административные права только по роли admin, а не по email или внешнему идентификатору. */
export function isOwnerAccount(user: { email?: string | null; openId?: string | null; role?: string | null }): boolean {
  return user.role === "admin";
}

/** Activity is not identity creation. Busy owners are skipped, never resurrected. */
/** Не чаще пяти минут обновляем активность уже аутентифицированного actor условным SKIP LOCKED чтением; занятость, удаление или новый epoch не создают аккаунт заново. */
export async function recordAuthenticatedActivity(
  user: Pick<User, "id" | "openId" | "sessionVersion"> & Partial<Pick<User, "lastSignedIn">>,
  signedInAt: Date,
): Promise<void> {
  const cutoff = new Date(signedInAt.getTime() - 5 * 60_000);
  // The actor was freshly read for authentication. Most reads need no write
  // transaction; the SQL condition below also arbitrates stale parallel reads.
  if (user.lastSignedIn && user.lastSignedIn > cutoff) return;
  const database = await getDb();
  if (!database) return;
  await database.transaction(async tx => {
    const [current] = await tx.select({ id: users.id }).from(users).where(and(
      eq(users.id, user.id),
      eq(users.openId, user.openId),
      eq(users.sessionVersion, user.sessionVersion),
      isNull(users.blockedAt),
      sql`(${users.lastSignedIn} IS NULL OR ${users.lastSignedIn} <= ${cutoff})`,
    )).for("update", { skipLocked: true });
    if (current) {
      await tx.update(users).set({ lastSignedIn: signedInAt }).where(eq(users.id, current.id));
    }
  });
}

/** Совместимо сохраняем явно переданные поля, но при конфликте любого уникального ключа обновляем только заблокированную запрошенную openId-идентичность; чужие credentials и роль не присваиваются. */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    /** Отличаем пропущенное поле от явного null и готовим одинаковое значение для вставки и разрешённого обновления. */
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);
    // The generic upsert only accepts a contact for a new identity.
    if (user.contactPhone !== undefined) values.contactPhone = user.contactPhone;
    if (user.name !== undefined) updateSet.profileRevision = sql`${users.profileRevision}+1`;

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.transaction(async (tx) => {
      // A duplicate may belong to any unique key, not just openId. Never
      // apply credentials to that row until the requested identity is locked.
      await tx.insert(users).values(values).onDuplicateKeyUpdate({
        set: { openId: sql`${users.openId}` },
      });
      const [identity] = await tx.select({ id: users.id }).from(users)
        .where(eq(users.openId, user.openId)).limit(1).for("update");
      if (!identity) throw new Error("User identity conflict");
      await tx.update(users).set(updateSet).where(eq(users.id, identity.id));
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user");
    throw error;
  }
}

/** Читаем текущую запись сессии по openId; отсутствие инфраструктуры бросает ошибку вместо подтверждения удалённой идентичности. */
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    // Unavailable storage is not evidence that this identity was deleted.
    throw new Error("Database unavailable");
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Ищем нормализованный email одним запросом; совместимый путь без настроенной БД возвращает undefined, поэтому вызывающий код отдельно проверяет готовность записи. */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Ищем точный нормализованный номер старого SMS-контракта; отсутствие подключения сохраняет совместимый undefined. */
export async function getUserByPhone(phone: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Возвращаем существующий аккаунт либо вставляем email-идентичность без перезаписи победителя гонки, затем проверяем принадлежность нормализованного адреса. */
export async function ensureUserByEmail(email: string): Promise<User> {
  const normalized = normalizeEmail(email);
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // A registration can win after the lookup. Preserve its row on duplicate.
  await db.insert(users).values({
    openId: emailToOpenId(normalized),
    email: normalized,
    loginMethod: "email",
  }).onDuplicateKeyUpdate({ set: { openId: sql`${users.openId}` } });

  const created = await getUserByEmail(normalized);
  if (!created || normalizeEmail(created.email || "") !== normalized)
    throw new Error("Не удалось создать аккаунт");
  return created;
}

// ── Profile update ──
/** Внутренний совместимый путь меняет лишь переданные поля профиля и увеличивает ревизию имени/пола; HTTP-редактор использует отдельный saveProfile с precondition. */
export async function updateUserProfile(userId: number, data: { name?: string; gender?: "female" | "male"; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update profile: database not available");
    throw new Error("Database not available");
  }

  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.gender !== undefined) updateSet.gender = data.gender;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;

  if (Object.keys(updateSet).length === 0) return;
  if (data.name !== undefined || data.gender !== undefined)
    updateSet.profileRevision = sql`${users.profileRevision}+1`;

  const [result] = await db.update(users).set(updateSet).where(eq(users.id, userId));
  if (result.affectedRows === 0) throw new Error("Profile account not found");
}

// ── Feed queries ──

import { posts, Post, InsertPost, Tag, Video, InsertVideo, penPalProfiles, penPalShown, PenPalProfile, clubPayments, ClubPayment, shopPurchases, ShopPurchase, postComments, commentLikes, commentReports, Article } from "../../../packages/database/src/schema";
import { desc, and, sql, or, ne, gte, isNull } from "drizzle-orm";

// Get all published posts, optionally filtered by tag
/** Совместимое чтение списка сохраняет существующие фильтры и ограничение размера. */
export async function getPosts(tagFilter?: string): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  return readPosts(await getDb(), tagFilter);
}

// Get paginated published posts (offset-based with SQL limit)
/** Старый числовой курсор остаётся offset; единый снимок защищает ответ, но не всю цепочку страниц. */
export async function getPostsPaginated(options: {
  tagFilter?: string;
  search?: string;
  limit: number;
  cursor?: number; // offset (page number * limit)
}) {
  return readPostPage(await getDb(), options);
}

// Get a single post by ID
/** Пост и медиа читаем из одного снимка; окончательное решение о доступе остаётся у сервиса. */
export async function getPostById(id: number | string) {
  return readPostDetail(await getDb(), id);
}

// Get all tags ordered by sortOrder
/** Справочник включает и ещё неиспользованные теги; это не выборка только по опубликованным постам. */
export async function getAllTags(): Promise<Tag[]> {
  return readAllTags(await getDb());
}

// Toggle like on a post
/** Делегируем переключение лайка в общую транзакцию с текущим actor и проверкой клубного доступа; сетевой повтор остаётся новым toggle. */
export async function toggleLike(actor: ContentWriteActor, postId: number, hasClubAccess: ReactionAccessCheck): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return togglePostReaction(db, "like", actor, postId, hasClubAccess);
}

// Toggle save/bookmark on a post
/** Делегируем переключение сохранения в ту же сериализованную политику доступа, не обещая идемпотентность повторного toggle. */
export async function toggleSave(actor: ContentWriteActor, postId: number, hasClubAccess: ReactionAccessCheck): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return togglePostReaction(db, "save", actor, postId, hasClubAccess);
}

// Get user's liked post IDs
/** Личные лайки выбираем по владельцу, не смешивая состояние разных аккаунтов. */
export async function getUserLikedPostIds(userId: number): Promise<number[]> {
  return readUserLikedPostIds(await getDb(), userId);
}

// Get user's saved post IDs
/** Личные сохранения выбираем по владельцу для последующей разрешённой выдачи. */
export async function getUserSavedPostIds(userId: number): Promise<number[]> {
  return readUserSavedPostIds(await getDb(), userId);
}

/** Восстанавливаем ограниченный набор карточек по известным ID через общий путь чтения медиа. */
export async function getPostsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return readPostsByIds(await getDb(), ids);
}

/** Читаем административную проекцию участников через переданный клиент БД. */
export async function listAdminMembers(): Promise<{
  id: number;
  email: string | null;
  contactPhone: string | null;
  name: string | null;
  role: string | null;
  createdAt: Date;
  clubExpiresAt: Date | null;
  blockedAt: Date | null;
  blockedReason: string | null;
}[]> {
  const db = await getDb();
  return readAdminMembers(db);
}

/** Чтение истории не вызывает провайдера и не меняет оплаченный срок. */
export async function listAdminPayments(limit = 50) {
  const db = await getDb();
  return readAdminPayments(db, limit);
}

/** Передаём ограниченный запрос участников и контекст администратора в keyset-репозиторий вместо чтения всего списка. */
export async function listAdminMembersPage(actorId: number, input: z.infer<typeof membersPageInput>) {
  return membersPage(await getDb(), actorId, input);
}
/** Передаём страницу платежей с контекстом администратора в самостоятельную ограниченную выборку. */
export async function listAdminPaymentsPage(actorId: number, input: z.infer<typeof paymentsPageInput>) {
  return paymentsPage(await getDb(), actorId, input);
}

// ── Admin: Post CRUD ──

/** Внутренний низкоуровневый helper вставляет только строку поста; редактор с медиа и восстановлением обязан использовать канонический транзакционный путь. */
export async function createPost(data: InsertPost): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values(data);
  return Number(result[0].insertId);
}

/** Сохраняем публикацию и связанные медиа через переданный контекст записи. */
export async function createPostWithVideos(
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges = {},
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistNewPost(db, data, videos, attachments);
}

/** Внутренний совместимый helper обновляет строку без протокола редакторской ревизии; сохранение редактора проходит через savePostEdit. */
export async function updatePost(id: number, data: Partial<InsertPost>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(posts).set(data).where(eq(posts.id, id));
}

/** Один ключ принятого намерения восстанавливает прежний результат, вместо создания дубля. */
export async function createPostOnce(
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
  intent: PostCreationIntent,
): Promise<{ postId: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistPostOnce(db, data, videos, attachments, intent);
}

/** Передаём частичную правку, видео, приватные квитанции и ожидаемую ревизию общему атомарному редактору поста. */
export async function savePostEdit(
  id: number,
  data: Partial<InsertPost>,
  videos?: string[],
  attachments: PostAttachmentChanges = {},
  condition?: ContentEditPrecondition,
): Promise<PostPublication | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistPostEdit(db, id, data, videos, attachments, condition);
}

/** Проверяем актуальное состояние публикации и удаляем её зависимости согласованно. */
export async function deletePost(id: number, actor?: ContentWriteActor): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistPostDeletion(db, id, actor);
}

// Get all posts for admin (including unpublished)
/** Совместимый список админки сохраняет её правила видимости и ограничение старого контракта. */
export async function getAllPostsAdmin(): Promise<(Post & { media: PostMedia[] })[]> {
  return readAllAdminPosts(await getDb());
}

/** Читаем только страницу административного списка; календарь и счётчики запрашиваются отдельно. */
export async function getAdminPostsPage(input: z.infer<typeof adminPostsPageInput>) {
  return readAdminPostsPage(await getDb(), input);
}

/** Детали и вложения читаем согласованно, включая скрытые от общего каталога записи. */
export async function getAdminPostDetail(id: number) {
  return readAdminPostDetail(await getDb(), id);
}

/** Считаем состояния постов на сервере без передачи всего списка в браузер. */
export async function getAdminPostCounts() {
  return readAdminPostCounts(await getDb());
}

/** Возвращаем данные выбранного интервала календаря, а не полные тела всех публикаций. */
export async function getAdminPostCalendar(input: z.infer<typeof adminPostCalendarInput>) {
  return readAdminPostCalendar(await getDb(), input);
}

// Get post by Instagram ID (for dedup during import)
/** Внутренне ищем запись импорта по исходному Instagram ID, включая скрытые посты для дедупликации. */
export async function getPostByInstagramId(instagramId: string): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(posts)
    .where(eq(posts.instagramId, instagramId))
    .limit(1);

  return result[0];
}

/** Ищем внутреннюю запись по точному source без фильтра публичности, например для связи анонса статьи. */
export async function getPostBySource(source: string): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.source, source)).limit(1);
  return result[0];
}

// ── Push Tokens ──

export type PushWriteActor = Pick<User, "id" | "openId" | "sessionVersion">;

/** Блокируем текущую идентичность и epoch пользователя перед записью push-данных; отзыв сессии и блокировка сериализуются с изменением токена. */
async function lockPushActor(tx: Pick<MySql2Database, "select">, actor: PushWriteActor) {
  // Та же блокировка, что при отзыве сессии и блокировке аккаунта.
  // Проверка и запись push-данных выполняются в одной транзакции.
  const [current] = await tx
    .select({
      openId: users.openId,
      sessionVersion: users.sessionVersion,
      blockedAt: users.blockedAt,
      role: users.role,
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
  if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}

/** Сохраняем устройство: гостевой upsert не перепривязывает существующий аккаунт, авторизованный выполняется под текущей блокировкой; флаг, формат и квоты проверяются выше. */
export async function registerPushToken(
  token: string,
  actor?: PushWriteActor,
  platform?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Гость может зарегистрировать устройство. У существующего токена
  // привязку к аккаунту меняет только запрос с действующей сессией.
  /** Применяем единый upsert токена к переданному writer, сохраняя текущую привязку при отсутствии actor. */
  const save = (writer: Pick<MySql2Database, "insert">) =>
    writer.insert(pushTokens).values({
      token,
      userId: actor?.id ?? null,
      platform: platform ?? null,
      enabled: true,
    }).onDuplicateKeyUpdate({
      set: {
        userId: actor?.id,
        platform,
        enabled: true,
      },
    });

  if (!actor) {
    await save(db);
    return;
  }
  await db.transaction(async (tx) => {
    await lockPushActor(tx, actor);
    await save(tx);
  });
}

/** Возвращаем включённые токены существующих незаблокированных владельцев; это техническая выборка без маркетингового согласия. */
export async function getAllEnabledPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), isNull(users.blockedAt)));

  return results.map((r) => r.token);
}

/** Выбираем включённые устройства только указанного незаблокированного пользователя перед дополнительной проверкой аудитории отправки. */
export async function getPushTokensForUser(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), eq(pushTokens.userId, userId), isNull(users.blockedAt)));
  return results.map((r) => r.token);
}

/** Совместимо собираем токены оплаченных участниц и администраторов, исключая заблокированных владельцев; маркетинговое согласие проверяется отдельным путём. */
export async function getClubMemberPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const paid = await db
    .select({ userId: clubPayments.userId })
    .from(clubPayments)
    .where(and(eq(clubPayments.status, "paid"), gte(clubPayments.expiresAt, now)));
  const admins = await db
    .select({ id: users.id, email: users.email, openId: users.openId, role: users.role })
    .from(users);
  const memberIds = new Set<number>(paid.map((row) => row.userId));
  for (const user of admins) {
    if (isOwnerAccount(user)) memberIds.add(user.id);
  }
  if (memberIds.size === 0) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(and(eq(pushTokens.enabled, true), inArray(pushTokens.userId, [...memberIds]), isNull(users.blockedAt)));

  return results.map((r) => r.token);
}

/** Под текущей блокировкой владельца добавляем событие согласия или отзыва с категорией, версией и ограниченным текстом. */
export async function logPushConsentEvent(
  actor: PushWriteActor,
  consentType: PushConsentType,
  status: PushConsentStatus,
  platform?: string,
  consentVersion: string = MARKETING_PUSH_CONSENT_VERSION,
  consentText?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.transaction(async (tx) => {
    await lockPushActor(tx, actor);
    await tx.insert(pushConsentEvents).values({
      userId: actor.id,
      consentType,
      status,
      consentVersion,
      consentText: consentText?.slice(0, 8000) ?? null,
      platform: platform ?? null,
    });
  });
}

/** Читаем последнее маркетинговое событие по дате и ID; наличие токена или более старого granted не заменяет текущего согласия. */
export async function hasMarketingPushConsent(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const rows = await db
    .select({ status: pushConsentEvents.status })
    .from(pushConsentEvents)
    .where(and(eq(pushConsentEvents.userId, userId), eq(pushConsentEvents.consentType, "marketing")))
    .orderBy(desc(pushConsentEvents.createdAt), desc(pushConsentEvents.id))
    .limit(1);

  return rows[0]?.status === "granted";
}

/** Сворачиваем историю событий в последнее решение каждого пользователя и возвращаем только актуальные granted. */
async function getUserIdsWithMarketingConsent(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();

  const rows = await db
    .select({
      userId: pushConsentEvents.userId,
      status: pushConsentEvents.status,
    })
    .from(pushConsentEvents)
    .where(eq(pushConsentEvents.consentType, "marketing"))
    .orderBy(desc(pushConsentEvents.createdAt), desc(pushConsentEvents.id));

  const latest = new Map<number, PushConsentStatus>();
  for (const row of rows) {
    if (!latest.has(row.userId)) {
      latest.set(row.userId, row.status);
    }
  }

  return new Set(
    [...latest.entries()].filter(([, status]) => status === "granted").map(([userId]) => userId),
  );
}

/** Собираем техническое множество оплаченных пользователей и администраторов для последующего ограничения аудитории push. */
async function getClubMemberUserIds(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();

  const now = new Date();
  const paid = await db
    .select({ userId: clubPayments.userId })
    .from(clubPayments)
    .where(and(eq(clubPayments.status, "paid"), gte(clubPayments.expiresAt, now)));
  const admins = await db
    .select({ id: users.id, email: users.email, openId: users.openId, role: users.role })
    .from(users);
  const memberIds = new Set<number>(paid.map((row) => row.userId));
  for (const user of admins) {
    if (isOwnerAccount(user)) memberIds.add(user.id);
  }
  return memberIds;
}

/** Пересекаем текущее маркетинговое согласие с клубной аудиторией при target=club и выбираем лишь включённые устройства незаблокированных владельцев. */
export async function getMarketingPushTokens(
  target: "feed" | "club" | "both" = "feed",
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const consented = await getUserIdsWithMarketingConsent();
  if (consented.size === 0) return [];

  let userIds = consented;
  if (target === "club") {
    const members = await getClubMemberUserIds();
    userIds = new Set([...consented].filter((id) => members.has(id)));
  }
  if (userIds.size === 0) return [];

  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(
      and(eq(pushTokens.enabled, true), inArray(pushTokens.userId, [...userIds]), isNull(users.blockedAt)),
    );

  return results.map((r) => r.token);
}

/** Выбираем служебную аудиторию без маркетингового согласия, но с текущим владельцем устройства, блокировкой и клубным ограничением; личное сообщение дополнительно сужается userId. */
export async function getServicePushTokens(
  target: "feed" | "club" | "both" = "feed",
  userId?: number,
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const memberIds = target === "club" ? await getClubMemberUserIds() : undefined;
  if (memberIds?.size === 0) return [];

  // Для личного push проверяем текущую привязку токена вместе с доступом
  // к аудитории. При смене аккаунта токен может остаться в общей аудитории.
  const results = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .innerJoin(users, eq(users.id, pushTokens.userId))
    .where(
      and(
        eq(pushTokens.enabled, true),
        isNull(users.blockedAt),
        memberIds ? inArray(pushTokens.userId, [...memberIds]) : undefined,
        userId !== undefined ? eq(pushTokens.userId, userId) : undefined,
      ),
    );

  return results.map((r) => r.token);
}

/** Под актуальной админской сессией удаляем устройства выбранного пользователя; право проверяется внутри той же транзакции. */
export async function deletePushTokensForUser(
  userId: number,
  actor: PushWriteActor,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(
    async (tx) => {
      // Роль могла измениться после входной проверки. Держим блокировку
      // администратора до завершения удаления устройств выбранного пользователя.
      const current = await lockPushActor(tx, actor);
      if (!isOwnerAccount(current)) throw new TRPCError({ code: "FORBIDDEN" });
      await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
    },
    { isolationLevel: "read committed" },
  );
}

/** Находим последнюю публикацию по серверному порядку выдачи. */
export async function getLatestPublishedPost(
  target: "feed" | "club",
): Promise<{ id: number; text: string } | undefined> {
  return readLatestPublishedPost(await getDb(), target);
}

// ── Videos ──

// Get all published videos ordered by sortOrder
/** Сохраняем прежний фасад чтения только опубликованных открытых YouTube-видео через профильный репозиторий. */
export async function getVideos(): Promise<PublicVideo[]> {
  return readVideos(await getDb());
}

// Public details must obey the same publication gate as the list.
/** Читаем прежнюю публичную YouTube-карточку по тем же ограничениям, что и список. */
export async function getVideoById(id: number): Promise<PublicVideo | undefined> {
  return readVideoById(await getDb(), id);
}

// Get video by YouTube ID (for dedup)
/** Внутренне находим сырой YouTube-источник, включая неопубликованный, для дедупликации и повторной проверки playback. */
export async function getVideoByYoutubeId(youtubeId: string): Promise<Video | undefined> {
  return readVideoByYoutubeId(await getDb(), youtubeId);
}

/** Проверяем только наличие актуального публичного YouTube-источника без гидратации полного каталога. */
export async function isPublicYoutubeVideo(youtubeId: string) {
  return readPublicYoutubeVideo(await getDb(), youtubeId);
}

// Create a video entry
/** Передаём подготовленную внутренним вызывающим кодом запись в репозиторий видео. */
export async function createVideo(data: InsertVideo): Promise<number> {
  return persistVideoCreation(await getDb(), data);
}

// Bulk import videos (skip duplicates)
/** Передаём импорт вместе с текущим actor в транзакционный репозиторий, который проверяет права и пропускает дубли. */
export async function bulkImportVideos(
  items: InsertVideo[],
  actor: ContentWriteActor,
): Promise<number> {
  return persistVideoImport(await getDb(), items, actor);
}

// Update video
/** Обновляем видео через общий репозиторий с увеличением редакторской ревизии. */
export async function updateVideo(id: number, data: Partial<InsertVideo>): Promise<void> {
  return persistVideoUpdate(await getDb(), id, data);
}

// Delete video
/** Удаляем строку каталога через репозиторий без удаления внешнего ролика или файлов. */
export async function deleteVideo(id: number): Promise<void> {
  return persistVideoDeletion(await getDb(), id);
}

// ── Enhanced Admin: Post queries with target/status ──

// Get published posts for a specific target (feed or club)
/** Фильтруем назначение Лента/Клуб до пагинации и гидратации вложений. */
export async function getPostsForTarget(target: "feed" | "club", options?: {
  tagFilter?: string;
  search?: string;
  limit?: number;
  cursor?: number;
  category?: ClubTabId;
  clubTag?: string;
}) {
  return readTargetPosts(await getDb(), target, options);
}

// Get admin posts with filters (all statuses)
/** Фильтры административного списка применяются до выдачи результата. */
export async function getAdminPostsFiltered(options?: {
  status?: "draft" | "scheduled" | "published";
  target?: "feed" | "club" | "both";
}): Promise<Post[]> {
  const db = await getDb();
  return readAdminPostsFiltered(db, options);
}

// Get scheduled posts (for calendar tracker)
/** Читаем отложенные публикации отдельно от общего пользовательского списка. */
export async function getScheduledPosts(): Promise<Post[]> {
  const db = await getDb();
  return readScheduledPosts(db);
}

// ── Post Media CRUD ──

/** Внутренний низкоуровневый helper вставляет строку медиа; канонический редактор отдельно согласует её с постом и приватными квитанциями. */
export async function createPostMedia(data: InsertPostMedia): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(postMedia).values(data);
  return Number(result[0].insertId);
}

/** Читаем вложения одного родительского поста в установленном порядке. */
export async function getPostMediaByPostId(postId: number): Promise<PostMedia[]> {
  const db = await getDb();
  return readPostMediaByPostId(db, postId);
}

/** Находим родительский пост и удаляем вложение через его каноническую транзакцию, сохраняя проверку итогового тела и явный внутренний допуск legacy-видео. */
export async function deletePostMediaById(id: number, actor?: ContentWriteActor): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [media] = await db.select({ postId: postMedia.postId }).from(postMedia).where(eq(postMedia.id, id)).limit(1);
  if (!media) return;
  await persistPostEdit(db, media.postId, {}, undefined, {
    actor, removedMediaIds: [id], allowLegacyVideoRemoval: true,
  });
}

/** Внутренний helper удаляет строки медиа поста без эффектов в хранилище; вызывающий код отвечает за целостность материала. */
export async function deletePostMediaByPostId(postId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(postMedia).where(eq(postMedia.postId, postId));
}

/** Совместимая замена видео использует блокировку поста и транзакцию общего редактора вместо отдельной незащищённой записи. */
export async function replacePostVideos(postId: number, urls: string[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use the same post lock and transaction as the canonical edit path.
  await persistPostEdit(db, postId, {}, urls);
}

/** Под текущей админской сессией очищаем технические имена камерных файлов массовой SQL-правкой без изменения самих вложений. */
export async function clearRawCameraFilenames(actor: ContentWriteActor): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async (tx) => {
    // Повторно проверяем роль и сессию под блокировкой перед массовым обновлением.
    await assertContentWriteActor(tx, actor);
    await tx
      .update(postMedia)
      .set({ filename: null })
      .where(sql`${postMedia.filename} REGEXP '^(IMG|DSC|VID|MOV|PXL|Screenshot|Photo|Video)[-_ ]?[0-9]'`);
  });
}

// Update post status (for confirming scheduled posts)
/** Передаём ручную публикацию в атомарный переход видимости; данные уведомления получает только вызов, реально изменивший статус. */
export async function confirmScheduledPost(postId: number, actor?: ContentWriteActor): Promise<PostPublication | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return confirmPostPublication(db, postId, actor);
}

/** Делегируем расписание общему SKIP LOCKED writer и возвращаем лишь его закоммиченную пачку. */
export async function publishDueScheduledPosts(): Promise<{ id: number; text: string; target: "feed" | "club" | "both" }[]> {
  return persistDueScheduledPosts(await getDb());
}

// ── Post Statistics (admin dashboard) ──
export interface PostStatistics {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  feedPosts: number;
  clubPosts: number;
  bothPosts: number;
  totalLikes: number;
  totalSaves: number;
  postsThisMonth: number;
  postsLastMonth: number;
  topLikedPosts: { id: number; text: string; likeCount: number }[];
}

/** Считаем агрегаты публикаций на стороне БД. */
export async function getPostStatistics(): Promise<PostStatistics> {
  const db = await getDb();
  return readPostStatistics(db);
}

// ── Pen pals ──

export type PenPalMatchCard = {
  userId: number;
  name: string | null;
  avatarUrl: string | null;
  city: string;
  address: string;
  interests: string[];
  sharedInterests: string[];
};

/** Нормализуем старый JSON интересов в массив строк, сохраняя порядок и повторы совместимого формата. */
function asInterestList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Внутренне читаем старую анкету по userId; публичный интерфейс использует actor-проверяемый V2-контракт. */
export async function getPenPalProfile(userId: number): Promise<PenPalProfile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(penPalProfiles).where(eq(penPalProfiles.userId, userId)).limit(1);
  return rows[0];
}

/** Сохраняем старую анкету city/interests/address без V2-согласия; этот совместимый helper не заменяет новый проверяемый HTTP-путь. */
export async function upsertPenPalProfile(userId: number, data: { city: string; interests: string[]; address: string }): Promise<PenPalProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(penPalProfiles).values({
    userId,
    city: data.city,
    interests: data.interests,
    address: data.address,
    active: true,
  }).onDuplicateKeyUpdate({
    set: {
      city: data.city,
      interests: data.interests,
      address: data.address,
      active: true,
    },
  });

  const saved = await getPenPalProfile(userId);
  if (!saved) throw new Error("Failed to save pen pal profile");
  return saved;
}

/** Совместимо выключаем старую анкету; полный отзыв связей и согласия реализован отдельно в pen-pals/profiles. */
export async function deactivatePenPalProfile(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(penPalProfiles).set({ active: false }).where(eq(penPalProfiles.userId, userId));
}

/** Прежний внутренний подбор ранжирует все активные анкеты в памяти и возвращает адрес; публичный V2-путь использует ограниченные карточки и взаимное подтверждение. */
export async function findPenPalMatches(userId: number, limit = 2): Promise<PenPalMatchCard[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mine = await getPenPalProfile(userId);
  if (!mine || !mine.active) return [];

  const myInterests = asInterestList(mine.interests);
  const [others, shownRows] = await Promise.all([
    db.select().from(penPalProfiles).where(and(eq(penPalProfiles.active, true), ne(penPalProfiles.userId, userId))),
    db.select({ matchUserId: penPalShown.matchUserId }).from(penPalShown).where(eq(penPalShown.userId, userId)),
  ]);
  const shown = new Set(shownRows.map((row) => row.matchUserId));

  const ranked = others
    .filter((profile) => !shown.has(profile.userId))
    .map((profile) => {
      const interests = asInterestList(profile.interests);
      const sharedInterests = interests.filter((interest) => myInterests.includes(interest));
      return { profile, interests, sharedInterests, score: sharedInterests.length };
    })
    .filter((row) => row.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  for (const row of ranked) {
    try {
      await db.insert(penPalShown).values({ userId, matchUserId: row.profile.userId });
    } catch {
      // already recorded for this pair
    }
  }

  const matchIds = ranked.map((row) => row.profile.userId);
  const matchUsers = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, matchIds));
  const userById = new Map(matchUsers.map((user) => [user.id, user]));

  return ranked.map((row) => {
    const user = userById.get(row.profile.userId);
    return {
      userId: row.profile.userId,
      name: user?.name ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      city: row.profile.city,
      address: row.profile.address,
      interests: row.interests,
      sharedInterests: row.sharedInterests,
    };
  });
}

/** Внутренне читаем полную SQL-модель пользователя по ID; публичные ответы обязаны применять отдельную явную проекцию. */
export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

const CLUB_ACCESS_MS = 31 * 24 * 60 * 60 * 1000;

/** Передаём подтверждённое платежное доказательство в единую транзакцию settlement, не начисляя доступ в фасаде. */
export async function settleClubPayment(input: Parameters<typeof settleClubOrder>[1]) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return settleClubOrder(database, input);
}

/** Сохраняем pending-заказ; контакт профиля меняется только при явном текущем actor той же почты и пользователя, гостевой email не даёт права обновлять аккаунт. */
export async function createClubPayment(data: {
  userId: number;
  orderId: string;
  email?: string | null;
  contactPhone?: string | null;
  contactActor?: Pick<User, "id" | "openId" | "sessionVersion">;
  sum: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    // An email on a public checkout is not permission to edit that account.
    // Fence the authenticated owner under the same lock as the payment write.
    if (data.contactActor) {
      const actor = data.contactActor;
      const [current] = await tx.select().from(users)
        .where(eq(users.id, actor.id)).for("update");
      if (!current || current.openId !== actor.openId || current.sessionVersion !== actor.sessionVersion)
        throw new TRPCError({ code: "UNAUTHORIZED" });
      if (current.blockedAt || current.accountDeletionRequestedAt)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (current.id !== data.userId || normalizeEmail(current.email || "") !== normalizeEmail(data.email || ""))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Используйте почту своего аккаунта" });
      if (data.contactPhone)
        await tx.update(users).set({ contactPhone: data.contactPhone }).where(eq(users.id, current.id));
    }
    await tx.insert(clubPayments).values({
      userId: data.userId,
      orderId: data.orderId,
      email: data.email ?? null,
      contactPhone: data.contactPhone ?? null,
      status: "pending",
      sum: data.sum,
    });
  });
}

/** Читаем конкретную запись платежа по orderId без вызова провайдера и начисления доступа. */
export async function getClubPaymentByOrderId(orderId: string): Promise<ClubPayment | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clubPayments).where(eq(clubPayments.orderId, orderId)).limit(1);
  return rows[0];
}

/** Читаем активный оплаченный срок через переданный SQL-reader либо общий пул, сохраняя транзакционный контекст проверок доступа. */
export async function getActiveClubSubscription(userId: number, reader?: Pick<MySql2Database, "select">): Promise<ClubPayment | undefined> {
  const db = reader ?? await getDb();
  if (!db) return undefined;
  return readActiveClubSubscription(db, userId);
}

/** Возвращаем максимальный срок среди оплаченных записей, не считая pending-заказ основанием членства. */
export async function getLatestClubExpiry(userId: number): Promise<Date | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ expiresAt: clubPayments.expiresAt })
    .from(clubPayments)
    .where(and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")))
    .orderBy(desc(clubPayments.expiresAt))
    .limit(1);
  return rows[0]?.expiresAt ? new Date(rows[0].expiresAt) : null;
}

/** Вычисляем совместимый следующий срок от максимума текущего времени и активного окончания; конкурентное начисление выполняет отдельный settlement под блокировкой. */
export async function nextClubExpiry(userId: number, periodMs = CLUB_ACCESS_MS): Promise<Date> {
  const active = await getActiveClubSubscription(userId);
  const currentEnd = active?.expiresAt ? new Date(active.expiresAt).getTime() : 0;
  const baseMs = Math.max(Date.now(), currentEnd);
  return new Date(baseMs + periodMs);
}

/** Делегируем ручное продление общей транзакции с проверкой исполнителя и стабильной записью доступа. */
export async function grantClubDays(userId: number, days = 31, actor?: User): Promise<Date> {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return grantClubAccess(database, userId, days, actor);
}

/** Низкоуровневый совместимый helper помечает заказ paid с готовым expiresAt; проверка доказательства и атомарный outbox принадлежат каноническому settlement. */
export async function markClubPaymentPaid(data: {
  userId: number;
  orderId: string;
  email?: string | null;
  sum?: string | null;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(clubPayments).where(eq(clubPayments.orderId, data.orderId)).limit(1);
  if (existing[0]) {
    await db.update(clubPayments).set({
      status: "paid",
      paidAt: new Date(),
      expiresAt: data.expiresAt,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      sum: data.sum ?? existing[0].sum,
      email: data.email ?? existing[0].email,
    }).where(eq(clubPayments.orderId, data.orderId));
    return;
  }

  await db.insert(clubPayments).values({
    userId: data.userId,
    orderId: data.orderId,
    email: data.email ?? null,
    sum: data.sum ?? null,
    status: "paid",
    paidAt: new Date(),
    expiresAt: data.expiresAt,
    cancelAtPeriodEnd: false,
  });
}

/** Через доменную отмену запрашиваем подтверждение провайдера; совместимый cancelled отражает только confirmed, а не наличие локальной заявки. */
export async function cancelClubSubscription(userId: number): Promise<{ cancelled: boolean; expiresAt: Date | null }> {
  // Compatibility facade: local flags are never an alternative to provider confirmation.
  const database=await getDb();if(!database) throw new Error("Database not available");
  const {requestClubCancellation}=await import("./billing/cancellation");
  const {cancelProdamusSubscription}=await import("./prodamus");
  const result=await requestClubCancellation(database,userId,cancelProdamusSubscription);
  return {cancelled:result.confirmed,expiresAt:result.expiresAt};
}

/** Сохраняем pending-покупку; для привязанного пользователя требуем того же actor и текущую сессию под разделяемой блокировкой, гостевой заказ остаётся без владельца. */
export async function createShopPurchase(
  data: {
    userId?: number | null;
    productId: string;
    orderId: string;
    email?: string | null;
  },
  actor?: Pick<User, "id" | "openId" | "sessionVersion">,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const purchase = {
    userId: data.userId ?? null,
    productId: data.productId,
    orderId: data.orderId,
    email: data.email ?? null,
    status: "pending" as const,
  };

  if (purchase.userId === null) {
    await db.insert(shopPurchases).values(purchase);
    return;
  }
  if (!actor || actor.id !== purchase.userId)
    throw new TRPCError({ code: "UNAUTHORIZED" });

  await db.transaction(async (tx) => {
    // Отзыв сессии и блокировка должны либо завершиться до проверки,
    // либо дождаться записи заказа. Параллельные покупки могут читать аккаунт.
    const [current] = await tx
      .select({
        openId: users.openId,
        sessionVersion: users.sessionVersion,
        blockedAt: users.blockedAt,
      })
      .from(users)
      .where(eq(users.id, actor.id))
      .for("share");
    if (
      !current ||
      current.openId !== actor.openId ||
      current.sessionVersion !== actor.sessionVersion
    )
      throw new TRPCError({ code: "UNAUTHORIZED" });
    if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
    await tx.insert(shopPurchases).values(purchase);
  });
}

/** Внутренне читаем состояние цифрового заказа по уникальному orderId без внешних действий. */
export async function getShopPurchaseByOrderId(orderId: string): Promise<ShopPurchase | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(shopPurchases).where(eq(shopPurchases.orderId, orderId)).limit(1);
  return rows[0];
}

/** Совместимо создаём или обновляем paid-запись цифрового товара; этот путь не является атомарным клубным settlement и доступен только за выключенной capability магазина. */
export async function markShopPurchasePaid(data: {
  userId?: number | null;
  productId: string;
  orderId: string;
  email?: string | null;
  sum?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(shopPurchases).where(eq(shopPurchases.orderId, data.orderId)).limit(1);
  if (existing[0]) {
    await db.update(shopPurchases).set({
      status: "paid",
      paidAt: new Date(),
      sum: data.sum ?? existing[0].sum,
      email: data.email ?? existing[0].email,
      userId: data.userId ?? existing[0].userId,
      productId: data.productId || existing[0].productId,
    }).where(eq(shopPurchases.orderId, data.orderId));
    return;
  }
  await db.insert(shopPurchases).values({
    userId: data.userId ?? null,
    productId: data.productId,
    orderId: data.orderId,
    email: data.email ?? null,
    sum: data.sum ?? null,
    status: "paid",
    paidAt: new Date(),
  });
}

/** Проверяем наличие paid-покупки указанного товара у конкретного пользователя; pending-запись владения не даёт. */
export async function userOwnsShopProduct(userId: number, productId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(shopPurchases)
    .where(and(eq(shopPurchases.userId, userId), eq(shopPurchases.productId, productId), eq(shopPurchases.status, "paid")))
    .limit(1);
  return Boolean(rows[0]);
}


/** Читаем опубликованные статьи; окончательное правило выдачи тела задаёт сервис. */
export async function listPublishedArticles(): Promise<Article[]> {
  const db = await getDb();
  return readPublishedArticles(db);
}

/** Карточки списка отделены от полного содержимого статьи. */
export async function listPublishedArticleCards() {
  return readPublishedArticleCards(await getDb());
}

/** Совместимое административное чтение сохраняет и неопубликованные статьи. */
export async function listAllArticles(): Promise<Article[]> {
  const db = await getDb();
  return readAllArticles(db);
}

/** Находим одну статью; отсутствие строки не должно подменять ошибку инфраструктуры. */
export async function getArticleById(id: number): Promise<Article | undefined> {
  const db = await getDb();
  return readArticleById(db, id);
}

/** Читаем полное состояние статьи для редактора, сохраняя возможность увидеть черновик. */
export async function getAdminArticleDetail(id: number) {
  return readAdminArticleDetail(await getDb(), id);
}

/** Создание статьи, запись намерения и связанные изменения выполняются согласованно. */
export async function createArticle(data: CreateArticleInput, intent?: ArticleCreationIntent, actor?: ContentWriteActor): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return persistArticleCreation(db, data, intent, actor);
}

/** Восстанавливаем результат прежнего ключа создания статьи через профильный журнал без повторной записи материала. */
export async function getArticleCreationStatus(actorUserId: number, key: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return readArticleCreationStatus(db, actorUserId, key);
}

/** Проверяем ожидаемую версию и сохраняем изменение статьи вместе с её зависимостями. */
export async function updateArticle(id: number, data: UpdateArticleInput, actor?: ContentWriteActor, condition?: ContentEditPrecondition): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistArticleUpdate(db, id, data, actor, condition);
}

/** Удаляем статью через её текущие связи; доступ проверяется на административной границе. */
export async function deleteArticle(id: number, actor?: ContentWriteActor): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await persistArticleDeletion(db, id, actor);
}
