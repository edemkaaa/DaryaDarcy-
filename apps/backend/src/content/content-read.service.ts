/** Правила видимости публикаций, статей и видео применяются до возврата данных клиенту. */
import { Injectable } from "@nestjs/common";
import type { User } from "../../../../packages/database/src/schema";
import { userHasClubAccess } from "../identity/club-access";
import * as db from "../db";
import type { z } from "zod";
import type { adminPostsPageInput, adminPostCalendarInput } from "./admin-post-reads";
import { savedPostsPage, type savedPostsPageInput } from "./saved-posts-page";
import { postInteractionsForIds } from "./post-interactions-batch";
import { adminArticlesPage, type adminArticlesPageInput } from "./admin-article-page";

@Injectable()
export class ContentReadService {
  // Administrative views include private/unpublished content: adapters must use
  // adminProcedure before calling these reads, never the public feed boundary.
  /** Совместимое полное admin-чтение включает private/unpublished; вызывающий адаптер обязан использовать adminProcedure. */
  listAllAdminPosts() {
    return db.getAllPostsAdmin();
  }

  /** Делегирует validated limit/status/target в сокращённую editor-страницу без загрузки всех тел и вложений. */
  listAdminPostsPage(input: z.infer<typeof adminPostsPageInput>) {
    return db.getAdminPostsPage(input);
  }

  /** Возвращает согласованный полный editor detail и editRevision, включая скрытые от публичного каталога строки. */
  adminPostDetail(id: number) {
    return db.getAdminPostDetail(id);
  }

  /** Получает SQL-счётчики header админки отдельно от загрузки списка публикаций. */
  adminPostCounts() {
    return db.getAdminPostCounts();
  }

  /** Передаёт проверенные границы локальных дней в отдельную ограниченную календарную выборку. */
  adminPostCalendar(input: z.infer<typeof adminPostCalendarInput>) {
    return db.getAdminPostCalendar(input);
  }

  /** Совместимый admin-read возвращает полный capped список статей, включая черновики и закрытые sections. */
  listAllAdminArticles() {
    return db.listAllArticles();
  }
  /** Читает actor-bound страницу кратких редакторских карточек без полного содержимого sections. */
  async listAdminArticleCards(actorId: number, input: z.infer<typeof adminArticlesPageInput>) {
    return adminArticlesPage(await db.getDb(), actorId, input);
  }
  /** Получает одну полную admin-статью с нормализованными blocks и версией для безопасного редактирования. */
  async adminArticleDetail(id: number) {
    return db.getAdminArticleDetail(id);
  }

  /** Ограничивает совместимую административную выдачу по status/target, не применяя публичный published-фильтр. */
  listAdminPosts(input?: {
    status?: "draft" | "scheduled" | "published";
    target?: "feed" | "club" | "both";
  }) {
    return db.getAdminPostsFiltered(input);
  }

  /** Возвращает scheduled-записи для административного календаря без самостоятельной публикации. */
  listScheduledPosts() {
    return db.getScheduledPosts();
  }

  /** Внутреннее административное чтение вложений поста; публичная доступность parent проверяется другими границами. */
  postMedia(postId: number) {
    return db.getPostMediaByPostId(postId);
  }

  /** Читает SQL-агрегаты состояний постов для административной статистики без передачи тел. */
  postStatistics() {
    return db.getPostStatistics();
  }

  /** Возвращает опубликованные feed/both записи с общим tag-фильтром через согласованное чтение media. */
  listFeed(tag?: string) {
    return db.getPosts(tag);
  }

  /** Читает последнюю открытую публикацию и добавляет последнюю клубную только при текущем club-доступе, отдавая компактные id/text. */
  async latestNotification(user: User | null) {
    const feed = await db.getLatestPublishedPost("feed");
    let club: { id: number; text: string } | undefined;
    if (user && (await userHasClubAccess(user))) {
      club = await db.getLatestPublishedPost("club");
    }
    return {
      feedId: feed?.id ?? null,
      feedText: feed?.text ?? "",
      clubId: club?.id ?? null,
      clubText: club?.text ?? "",
    };
  }

  /** Передаёт search/tag/limit и совместимый numeric-offset в серверную страницу, не сортируя результат повторно. */
  listFeedPage(input: {
    tag?: string;
    search?: string;
    limit: number;
    cursor?: number | null;
  }) {
    return db.getPostsPaginated({
      tagFilter: input.tag,
      search: input.search,
      limit: input.limit,
      cursor: input.cursor ?? undefined,
    });
  }

  /** Читает опубликованные общие теги через единый DB-фасад, не создавая пользовательское состояние. */
  listTags() {
    return db.getAllTags();
  }

  /** Совместимый публичный каталог выбирает только published/public YouTube-записи, не private VK playback. */
  listVideos() {
    return db.getVideos();
  }

  /** Возвращает постоянного размера public-authority признак для одного legacy YouTube ID без источника потока. */
  async publicYoutubeState(youtubeId: string) {
    return { published: await db.isPublicYoutubeVideo(youtubeId) };
  }

  /** Возвращает только существующее публичное legacy-видео; VK и закрытый playback проходят отдельный контракт. */
  videoById(id: number) {
    return db.getVideoById(id);
  }

  /** Разрешает published/status=published detail по id/publicId; club-only пост скрыт без пользователя с клубным доступом. */
  async postById(id: number | string, user: User | null) {
    const post = await db.getPostById(id);
    if (!post || !post.published || post.status !== "published")
      return undefined;
    if (post.target === "club") {
      if (!user || !(await userHasClubAccess(user))) return undefined;
    }
    return post;
  }

  /** Совместимое сохранённое читает лишь свои IDs, затем исключает unpublished и недоступные club-посты, сохраняя открытые без подписки. */
  async savedPosts(user: User) {
    const ids = await db.getUserSavedPostIds(user.id);
    const posts = await db.getPostsByIds(ids);
    const hasClub = await userHasClubAccess(user);
    return posts.filter(
      (post) =>
        post.published &&
        post.status === "published" &&
        (hasClub || post.target !== "club"),
    );
  }

  /** Передаёт current user и target-bound cursor в серверную keyset-пагинацию сохранённого. */
  async savedPostsPage(user: User, input: z.infer<typeof savedPostsPageInput>) {
    return savedPostsPage(await db.getDb(), user, input);
  }

  /** Параллельно читает собственные liked/saved IDs; тела и чужие действия в этот компактный ответ не входят. */
  async userInteractions(userId: number) {
    const [likedIds, savedIds] = await Promise.all([
      db.getUserLikedPostIds(userId),
      db.getUserSavedPostIds(userId),
    ]);
    return { likedIds, savedIds };
  }
  /** Возвращает реакции только для ограниченного набора доступных постов текущего пользователя. */
  async interactionsForPosts(user: User, postIds: number[]) {
    return postInteractionsForIds(await db.getDb(), user, postIds);
  }

  /** Публичный список читает только карточки, не загружая закрытые sections ради последующего удаления из ответа. */
  async listArticles() {
    // Do not load private sections just to discard them for public cards.
    return db.listPublishedArticleCards();
  }

  /** Скрывает отсутствующую/неопубликованную статью; недоступной club-статье выдаёт лишь карточку locked с пустыми sections. */
  async articleById(id: number, user: User | null) {
    const article = await db.getArticleById(id);
    if (!article || !article.published) return undefined;
    const allowed =
      article.access === "public" ||
      Boolean(user && (await userHasClubAccess(user)));
    if (!allowed) {
      return {
        id: article.id,
        title: article.title,
        coverUrl: article.coverUrl,
        access: article.access,
        locked: true as const,
        sections: [],
      };
    }
    return {
      id: article.id,
      title: article.title,
      coverUrl: article.coverUrl,
      access: article.access,
      locked: false as const,
      sections: article.sections || [],
    };
  }
}
