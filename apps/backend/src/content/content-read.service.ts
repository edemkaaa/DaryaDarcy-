import { Injectable } from "@nestjs/common";
import type { User } from "../../../../packages/database/src/schema";
import { userHasClubAccess } from "../identity/club-access";
import * as db from "../db";
import type { z } from "zod";
import type { adminPostsPageInput, adminPostCalendarInput } from "./admin-post-reads";
import type { PublicVideo } from "./video-repository";

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

  async listVideos(): Promise<PublicVideo[]> {
    // Retired YouTube wire shape stays empty, including when VK is disabled.
    // Never put VK capabilities into an anonymous worker's legacy catalog.
    return [];
  }

  async videoById(): Promise<PublicVideo | undefined> {
    return undefined;
  }

  async postById(id: number, user: User | null) {
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

  async userInteractions(userId: number) {
    const [likedIds, savedIds] = await Promise.all([
      db.getUserLikedPostIds(userId),
      db.getUserSavedPostIds(userId),
    ]);
    return { likedIds, savedIds };
  }

  async listArticles() {
    const rows = await db.listPublishedArticles();
    // Public catalog cards do not grant access to the article's sections.
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      coverUrl: row.coverUrl,
      access: row.access,
    }));
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
