import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../../../packages/database/src/schema";
import { SessionService } from "../identity/session.service";

// Compatibility entry point: share Nest's policy without retaining an actor.
const sessions = new SessionService();

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: await sessions.optionalUser(opts.req),
  };
}
