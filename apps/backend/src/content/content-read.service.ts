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
}
