import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";

export const videosRouter = router({
  list: publicProcedure.query(() => {
    return db.getVideos();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return db.getVideoById(input.id);
    }),
});
