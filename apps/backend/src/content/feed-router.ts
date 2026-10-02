import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  userHasClubAccess,
} from "../_core/trpc";
import * as db from "../db";

export const feedRouter = router({
  // Get published posts (public)
  list: publicProcedure
    .input(z.object({ tag: z.string().optional() }).optional())
    .query(({ input }) => {
      return db.getPosts(input?.tag);
    }),

  // Paginated posts (public) - offset-based with search
  listPaginated: publicProcedure
    .input(
      z.object({
        tag: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(12),
        cursor: z.number().nullish(), // offset value
      }),
    )
    .query(({ input }) => {
      return db.getPostsPaginated({
        tagFilter: input.tag,
        search: input.search,
        limit: input.limit,
        cursor: input.cursor ?? undefined,
      });
    }),

  // Get single post by ID (public feed; club posts only for subscribers)
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const post = await db.getPostById(input.id);
      if (!post || !post.published || post.status !== "published")
        return undefined;
      if (post.target === "club") {
        if (!ctx.user) return undefined;
        if (!(await userHasClubAccess(ctx.user))) return undefined;
      }
      return post;
    }),

  // Get all tags (public)
  tags: publicProcedure.query(() => {
    return db.getAllTags();
  }),

  // Toggle like (requires auth)
  toggleLike: protectedProcedure
    .input(z.object({ postId: z.coerce.number() }))
    .mutation(({ ctx, input }) => {
      return db.toggleLike(ctx.user.id, input.postId);
    }),

  // Toggle save/bookmark (requires auth)
  toggleSave: protectedProcedure
    .input(z.object({ postId: z.coerce.number() }))
    .mutation(({ ctx, input }) => {
      return db.toggleSave(ctx.user.id, input.postId);
    }),

  // Get user's liked and saved post IDs (requires auth)
  userInteractions: protectedProcedure.query(({ ctx }) => {
    return Promise.all([
      db.getUserLikedPostIds(ctx.user.id),
      db.getUserSavedPostIds(ctx.user.id),
    ]).then(([likedIds, savedIds]) => ({ likedIds, savedIds }));
  }),
  savedPosts: protectedProcedure.query(async ({ ctx }) => {
    const ids = await db.getUserSavedPostIds(ctx.user.id);
    const posts = await db.getPostsByIds(ids);
    const hasClub = await userHasClubAccess(ctx.user);
    return posts.filter(
      (post) =>
        post.published &&
        post.status === "published" &&
        (hasClub || post.target !== "club"),
    );
  }),
});
