import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../../../packages/shared/src/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const { stack: _stack, ...data } = shape.data;
    return {
      ...shape,
      message: error.code === "INTERNAL_SERVER_ERROR" ? "Внутренняя ошибка сервера" : shape.message,
      data,
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

function isAdminUser(user: { role?: string | null; email?: string | null; openId?: string | null }) {
  return db.isOwnerAccount(user);
}

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.blockedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Аккаунт заблокирован. Напишите на daryadarcyapp@yandex.ru",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

function isModeratorUser(user: { role?: string | null; email?: string | null; openId?: string | null }) {
  if (user.role === "moderator" || user.role === "admin") return true;
  return isAdminUser(user);
}

export const moderatorProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isModeratorUser(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !isAdminUser(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export async function userHasClubAccess(user: {
  id: number;
  role?: string | null;
  email?: string | null;
  openId?: string | null;
  blockedAt?: Date | null;
}): Promise<boolean> {
  if (user.blockedAt) return false;
  if (db.isOwnerAccount(user)) return true;
  if (user.role === "admin" || user.role === "moderator") return true;
  return Boolean(await db.getActiveClubSubscription(user.id));
}

/** Authenticated users with an active club subscription (or staff). */
export const clubMemberProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!(await userHasClubAccess(ctx.user))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступно только участницам клуба Darcy",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
