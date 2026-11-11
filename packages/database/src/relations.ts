/** Описание навигационных связей Drizzle дополняет таблицы; само по себе не применяет ограничения в MySQL. */
import { relations } from "drizzle-orm";
import { users, posts, likes, savedPosts } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  likes: many(likes),
  savedPosts: many(savedPosts),
}));

export const postsRelations = relations(posts, ({ many }) => ({
  likes: many(likes),
  savedPosts: many(savedPosts),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, { fields: [likes.userId], references: [users.id] }),
  post: one(posts, { fields: [likes.postId], references: [posts.id] }),
}));

export const savedPostsRelations = relations(savedPosts, ({ one }) => ({
  user: one(users, { fields: [savedPosts.userId], references: [users.id] }),
  post: one(posts, { fields: [savedPosts.postId], references: [posts.id] }),
}));
