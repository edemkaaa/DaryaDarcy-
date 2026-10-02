import { z } from "zod";
import { router, publicProcedure, userHasClubAccess } from "../_core/trpc";
import * as db from "../db";

export const articlesRouter = router({
  list: publicProcedure.query(async () => {
    const rows = await db.listPublishedArticles();
    return rows
      .filter((row) => row.access === "public")
      .map((row) => ({
        id: row.id,
        title: row.title,
        coverUrl: row.coverUrl,
        access: row.access,
      }));
  }),
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const article = await db.getArticleById(input.id);
      if (!article || !article.published) return undefined;
      const user = ctx.user;
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
    }),
});
