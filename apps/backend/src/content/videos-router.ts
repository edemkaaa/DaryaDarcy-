import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import type { ContentReadService } from "./content-read.service";
import { videoCatalog, videoPlayback } from "./vk-catalog";
const id = z.number().int().positive().safe();

export const createVideosRouter = (content: ContentReadService) =>
  router({
    catalog: publicProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).default(20),
            cursor: id.optional(),
            // tRPC infinite queries send this hint; this catalog is forward-only.
            direction: z.literal("forward").optional(),
          })
          .strict()
          .default({ limit: 20 }),
      )
      .output(
        z
          .object({
            items: z.array(
              z
                .object({
                  id,
                  title: z.string(),
                  duration: z.string().nullable(),
                  access: z.enum(["public", "club"]),
                  canWatch: z.boolean(),
                })
                .strict(),
            ),
            nextCursor: id.nullable(),
          })
          .strict(),
      )
      .query(({ ctx, input }) => videoCatalog(ctx.user, input)),
    playback: publicProcedure
      .input(z.object({ id }).strict())
      .output(
        z.discriminatedUnion("provider", [
          z
            .object({
              id,
              provider: z.literal("vk"),
              embedUrl: z.string().url(),
            })
            .strict(),
          z
            .object({
              id,
              provider: z.literal("youtube"),
              youtubeId: z.string(),
              videoUrl: z.string().nullable(),
            })
            .strict(),
        ]),
      )
      .query(({ ctx, input }) => videoPlayback(ctx.user, input.id)),
    list: publicProcedure.query(() => content.listVideos()),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => content.videoById(input.id)),
  });
