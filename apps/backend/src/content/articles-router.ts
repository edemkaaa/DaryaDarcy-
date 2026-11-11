/** Схемы и tRPC-маршруты статей; чтение и правила видимости передаются сервису контента. */
import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import type { ContentReadService } from "./content-read.service";

/** Открывает публичные карточки и detail по id, передавая текущего user сервису для серверной проверки закрытых sections. */
export const createArticlesRouter = (content: ContentReadService) =>
  router({
    list: publicProcedure.query(() => content.listArticles()),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input, ctx }) => content.articleById(input.id, ctx.user)),
  });
