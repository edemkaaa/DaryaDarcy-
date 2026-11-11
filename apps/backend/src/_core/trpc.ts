/** Единые границы tRPC: формат ошибок, аутентификация и роли, затем доступ по подписке. */
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../../../packages/shared/src/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import * as db from "../db";
import { userHasClubAccess } from "../identity/club-access";
import { PUBLIC_CONTACT_EMAIL } from "../../../../packages/shared/src/contact";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "./service-availability";
export { userHasClubAccess } from "../identity/club-access";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const { stack: _stack, ...data } = shape.data;
    return {
      ...shape,
      message: error.code === "INTERNAL_SERVER_ERROR" ? "Внутренняя ошибка сервера"
        : error.code === "BAD_REQUEST" && error.cause instanceof SyntaxError ? "Некорректный запрос" : shape.message,
      data,
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure.use(async ({ next }) => {
  const result = await next();
  // Сохраняем явные доменные отказы. Только потерянный в обёртке признак
  // недоступности переводим из общего 500 в 503, не раскрывая SQL или cause.
  if (
    !result.ok &&
    result.error.code === "INTERNAL_SERVER_ERROR" &&
    isServiceUnavailable(result.error)
  )
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: SERVICE_UNAVAILABLE_MESSAGE,
      cause: result.error,
    });
  return result;
});

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
      message: `Аккаунт заблокирован. Напишите на ${PUBLIC_CONTACT_EMAIL}`,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

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

/** Только действующая сессия с клубным доступом либо разрешённая служебная роль. */
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
