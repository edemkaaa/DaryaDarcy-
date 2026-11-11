/** Получает пользователя для tRPC через сервис сессий, принадлежащий экземпляру приложения. */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../../../packages/database/src/schema";
import { SessionService } from "../identity/session.service";
import { TRPCError } from "@trpc/server";
import {
  isServiceUnavailable,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "./service-availability";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/** Привязывает контекст к конкретному SessionService; подтверждённый гость допустим, инфраструктурный отказ становится tRPC 503. */
export const createContextFactory =
  (sessions: Pick<SessionService, "optionalUser">) =>
  async (opts: CreateExpressContextOptions): Promise<TrpcContext> => {
    try {
      return {
        req: opts.req,
        res: opts.res,
        user: await sessions.optionalUser(opts.req),
      };
    } catch (error) {
      // Ошибка создания контекста возникает до middleware процедур.
      if (isServiceUnavailable(error))
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: SERVICE_UNAVAILABLE_MESSAGE,
          cause: error,
        });
      throw error;
    }
  };

// Совместимый отдельный вход; HTTP использует уже созданный Nest-провайдер.
export const createContext = createContextFactory(new SessionService());
