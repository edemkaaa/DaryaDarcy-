import { router, publicProcedure } from "../_core/trpc";
import { clearSessionCookie } from "../_core/cookies";
import { publicUser, SessionService } from "./session.service";

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

// Compatibility caller; HTTP supplies its application-owned session service.
export const authRouter = createAuthRouter(new SessionService());
