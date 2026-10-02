import { router, publicProcedure } from "../_core/trpc";
import { clearSessionCookie } from "../_core/cookies";

export const authRouter = router({
  me: publicProcedure.query((opts) => {
    const user = opts.ctx.user;
    if (!user) return null;
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.req, ctx.res);
    return {
      success: true,
    } as const;
  }),
});
