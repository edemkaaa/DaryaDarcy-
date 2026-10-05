import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import type { ContentReadService } from "./content-read.service";

export const createVideosRouter = (content: ContentReadService) =>
  router({
    list: publicProcedure.query(() => content.listVideos()),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => content.videoById(input.id)),
  });
