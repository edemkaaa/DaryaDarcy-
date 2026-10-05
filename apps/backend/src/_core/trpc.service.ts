import { Inject, Injectable } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ContentReadService } from "../content/content-read.service";
import { ContentWriteService } from "../content/content-write.service";
import { SessionService } from "../identity/session.service";
import { createAppRouter, type AppRouter } from "../routers";
import type { TrpcContext } from "./context";

/** Application-scoped composition; domain services never look up Nest globally. */
@Injectable()
export class TrpcService {
  readonly router: AppRouter;

  constructor(
    @Inject(ContentReadService) content: ContentReadService,
    @Inject(ContentWriteService) posts: ContentWriteService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {
    this.router = createAppRouter(content, posts);
  }

  readonly createContext = async (
    opts: CreateExpressContextOptions,
  ): Promise<TrpcContext> => ({
    req: opts.req,
    res: opts.res,
    user: await this.sessions.optionalUser(opts.req),
  });
}
