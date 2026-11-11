/** Nest guards и фильтр отказов для HTTP-сессии и ролей с безопасным форматом ответа. */
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

/** Устанавливается только успешным guard, никогда не берётся из присланного JSON. */
export type AuthenticatedRequest = Request & { authenticatedUser: User };

class SessionAccessRejection extends Error {
  /** Храним разрешённый HTTP-статус и вариант нейтрального ответа для guard без внутренних данных аутентификации. */
  constructor(
    readonly status: 401 | 403 | 415,
    readonly jsonError = false,
  ) {
    super("HTTP session access rejected");
  }
}

// Маршруты сохраняют исторически разные форматы ошибок.
// Guard выполняется до @Header, поэтому no-store для отказов устанавливаем здесь.
@Catch(SessionAccessRejection)
export class SessionAccessFilter implements ExceptionFilter {
  /** Устанавливаем no-store на отказах guard до контроллера, сохраняя прежний JSON либо пустой HTTP-формат маршрута. */
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
/** Загружает актуального пользователя и разрешает только роль администратора; отказ не кэшируется. */
export class AdministratorGuard implements CanActivate {
  /** Получаем сервис текущих сессий для проверки роли на нативных HTTP-маршрутах админки. */
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /** Проверяем JSON для PUT до сессии, затем текущего администратора; прикладываем authenticatedUser только после успешной проверки. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Сохраняем прежний порядок PUT настроек: content-type проверяется до сессии.
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
/** Повтор писем ограничен staff-ролью, JSON-телом и доверенным browser origin. */
export class AccessEmailStaffGuard implements CanActivate {
  /** Получаем сервис сессий для отдельной staff-границы повторной отправки писем. */
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /** Требуем JSON, проверенный browser Origin и текущую служебную роль; только guard устанавливает authenticatedUser, поле из тела не учитывается. */
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
