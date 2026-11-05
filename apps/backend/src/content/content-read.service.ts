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
  listAllAdminPosts() {
    return db.getAllPostsAdmin();
  }

  listAdminPostsPage(input: z.infer<typeof adminPostsPageInput>) {
    return db.getAdminPostsPage(input);
  }

  adminPostDetail(id: number) {
    return db.getAdminPostDetail(id);
  }

  adminPostCounts() {
    return db.getAdminPostCounts();
  }

  adminPostCalendar(input: z.infer<typeof adminPostCalendarInput>) {
    return db.getAdminPostCalendar(input);
  }

  listAllAdminArticles() {
    return db.listAllArticles();
  }
  async listAdminArticleCards(actorId: number, input: z.infer<typeof adminArticlesPageInput>) {
    return adminArticlesPage(await db.getDb(), actorId, input);
  }
  async adminArticleDetail(id: number) {
    return db.getAdminArticleDetail(id);
  }

  listAdminPosts(input?: {
    status?: "draft" | "scheduled" | "published";
    target?: "feed" | "club" | "both";
  }) {
    return db.getAdminPostsFiltered(input);
  }

  listScheduledPosts() {
    return db.getScheduledPosts();
  }

  postMedia(postId: number) {
    return db.getPostMediaByPostId(postId);
  }

  postStatistics() {
    return db.getPostStatistics();
  }

  listFeed(tag?: string) {
    return db.getPosts(tag);
  }

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

  listTags() {
    return db.getAllTags();
  }

  listVideos() {
    return db.getVideos();
  }

  async publicYoutubeState(youtubeId: string) {
    return { published: await db.isPublicYoutubeVideo(youtubeId) };
  }

  videoById(id: number) {
    return db.getVideoById(id);
  }

  async postById(id: number | string, user: User | null) {
    const post = await db.getPostById(id);
    if (!post || !post.published || post.status !== "published")
      return undefined;
    if (post.target === "club") {
      if (!user || !(await userHasClubAccess(user))) return undefined;
    }
    return post;
  }

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

  async savedPostsPage(user: User, input: z.infer<typeof savedPostsPageInput>) {
    return savedPostsPage(await db.getDb(), user, input);
  }

  async userInteractions(userId: number) {
    const [likedIds, savedIds] = await Promise.all([
      db.getUserLikedPostIds(userId),
      db.getUserSavedPostIds(userId),
    ]);
    return { likedIds, savedIds };
  }
  async interactionsForPosts(user: User, postIds: number[]) {
    return postInteractionsForIds(await db.getDb(), user, postIds);
  }

  async listArticles() {
    // Do not load private sections just to discard them for public cards.
    return db.listPublishedArticleCards();
  }

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
