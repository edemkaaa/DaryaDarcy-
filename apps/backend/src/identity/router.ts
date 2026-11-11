/** tRPC-входы чтения сессии и выхода используют тот же сервис сессий, что и REST. */
import { router, publicProcedure } from "../_core/trpc";
import { clearSessionCookie } from "../_core/cookies";
import { publicUser, SessionService } from "./session.service";

/** Возвращаем tRPC-публичную проекцию текущей сессии и выход через общий серверный отзыв до очистки cookie; инфраструктурный сбой не подменяется гостем. */
export const createAuthRouter = (
  sessions: Pick<SessionService, "revokeSessions">,
) =>
  router({
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      return publicUser(user);
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await sessions.revokeSessions(ctx.user);
      clearSessionCookie(ctx.req, ctx.res);
      return {
        success: true,
      } as const;
    }),
  });

// Совместимый отдельный вызов; HTTP передаёт сервис сессий своего приложения.
export const authRouter = createAuthRouter(new SessionService());
