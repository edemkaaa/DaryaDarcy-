import { Injectable } from "@nestjs/common";
import type { User } from "../../../../packages/database/src/schema";
import { userHasClubAccess } from "../identity/club-access";
import * as db from "../db";

@Injectable()
export class ContentReadService {
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
    return rows
      .filter((row) => row.access === "public")
      .map((row) => ({
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
