import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../../../packages/database/src/schema";
import { SessionService } from "../identity/session.service";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export const createContextFactory =
  (sessions: Pick<SessionService, "optionalUser">) =>
  async (opts: CreateExpressContextOptions): Promise<TrpcContext> => {
    return {
      req: opts.req,
      res: opts.res,
      user: await sessions.optionalUser(opts.req),
    };
  };

// Standalone compatibility entry; HTTP binds its existing Nest provider.
export const createContext = createContextFactory(new SessionService());
