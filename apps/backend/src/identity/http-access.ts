import {
  Catch,
  Inject,
  Injectable,
  type ArgumentsHost,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { User } from "../../../../packages/database/src/schema";
import { SessionService } from "./session.service";

/** Set only by a successful guard, never from the submitted JSON. */
export type AuthenticatedRequest = Request & { authenticatedUser: User };

class SessionAccessRejection extends Error {
  constructor(
    readonly status: 401 | 403 | 415,
    readonly jsonError = false,
  ) {
    super("HTTP session access rejected");
  }
}

// These HTTP routes predate Nest and deliberately have different error formats.
// Guards execute before @Header, so denials must also set no-store here.
@Catch(SessionAccessRejection)
export class SessionAccessFilter implements ExceptionFilter {
  catch(error: SessionAccessRejection, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader("Cache-Control", "no-store");
    if (error.jsonError) {
      response.status(error.status).json({ error: "Запрос недоступен." });
    } else {
      response.sendStatus(error.status);
    }
  }
}

@Injectable()
export class AdministratorGuard implements CanActivate {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Preserve settings PUT's content-type-before-auth ordering.
    if (request.method === "PUT" && !request.is("application/json")) {
      throw new SessionAccessRejection(415);
    }
    const user = await this.sessions.optionalUser(request);
    if (!user) throw new SessionAccessRejection(401);
    if (!this.sessions.isAdministrator(user))
      throw new SessionAccessRejection(403);
    request.authenticatedUser = user;
    return true;
  }
}

@Injectable()
export class AccessEmailStaffGuard implements CanActivate {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.is("application/json")) throw new SessionAccessRejection(415);
    const origin = request.headers.origin;
    if (origin) {
      let expectedOrigin: string;
      try {
        expectedOrigin = new URL(
          process.env.PUBLIC_APP_URL || "https://daryadarcy.com",
        ).origin;
      } catch {
        throw new SessionAccessRejection(403, true);
      }
      if (origin !== expectedOrigin) throw new SessionAccessRejection(403);
    }
    const user = await this.sessions.optionalUser(request);
    if (!user) throw new SessionAccessRejection(403, true);
    if (!this.sessions.isStaff(user)) throw new SessionAccessRejection(403);
    request.authenticatedUser = user;
    return true;
  }
}
