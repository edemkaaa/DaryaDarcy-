import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import type { ContentReadService } from "./content-read.service";

export const createFeedRouter = (content: ContentReadService) =>
  router({
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
      .query(({ input, ctx }) => content.postById(input.id, ctx.user)),

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
    userInteractions: protectedProcedure.query(({ ctx }) =>
      content.userInteractions(ctx.user.id),
    ),
    savedPosts: protectedProcedure.query(({ ctx }) =>
      content.savedPosts(ctx.user),
    ),
  });
