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

// Standalone compatibility entry; HTTP binds its existing Nest provider.
export const createContext = createContextFactory(new SessionService());
