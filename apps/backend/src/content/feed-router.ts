import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import type { ContentReadService } from "./content-read.service";
import type { ContentWriteService } from "./content-write.service";
import { savedPostsPageInput } from "./saved-posts-page";
import { postInteractionsInput } from "./post-interactions-batch";

export const createFeedRouter = (
  content: ContentReadService,
  posts: ContentWriteService,
) =>
  router({
    // Get published posts (public)
    list: publicProcedure
      .input(z.object({ tag: z.string().optional() }).optional())
      .query(({ input }) => content.listFeed(input?.tag)),

    // Paginated posts (public) - offset-based with search
    listPaginated: publicProcedure
      .input(
        z.object({
          tag: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(12),
          cursor: z.number().int().nonnegative().nullish(), // offset value
        }),
      )
      .query(({ input }) => content.listFeedPage(input)),

    // Get single post by ID (public feed; club posts only for subscribers)
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive().safe() }))
      .query(({ input, ctx }) => content.postById(input.id, ctx.user)),

    // Get all tags (public)
    tags: publicProcedure.query(() => content.listTags()),

    // Toggle like (requires auth)
    toggleLike: protectedProcedure
      .input(z.object({ postId: z.coerce.number().int().positive() }))
      .mutation(({ ctx, input }) => {
        return posts.toggleLike(ctx.user.id, input.postId);
      }),

    // Toggle save/bookmark (requires auth)
    toggleSave: protectedProcedure
      .input(z.object({ postId: z.coerce.number().int().positive() }))
      .mutation(({ ctx, input }) => {
        return posts.toggleSave(ctx.user.id, input.postId);
      }),

    // Get user's liked and saved post IDs (requires auth)
    userInteractions: protectedProcedure.query(({ ctx }) =>
      content.userInteractions(ctx.user.id),
    ),
    interactionsForPosts: protectedProcedure.input(postInteractionsInput)
      .query(({ ctx, input }) => content.interactionsForPosts(ctx.user, input.postIds)),
    savedPosts: protectedProcedure.query(({ ctx }) =>
      content.savedPosts(ctx.user),
    ),
    savedPostsPage: protectedProcedure.input(savedPostsPageInput)
      .query(({ ctx, input }) => content.savedPostsPage(ctx.user, input)),
  });
