/** HTTP-граница запроса, статуса и подтверждения привязки email с ограничением частоты. */
import { Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { SessionService } from "./session.service";
import { EmailBindingService } from "./email-binding.service";
import { EmailBindingError } from "./email-binding";
import {
  emailBindingConfirmationSchema,
  emailBindingReceiptSchema,
  emailBindingStatusSchema,
} from "./email-binding-http-contract";
import { checkRequestRateLimit } from "../_core/request-rate-limit";
import { clientIp } from "../sms-auth";
import { publicAccessUrl } from "./urls";

/** Отвечаем нейтральной ошибкой заданного HTTP-статуса без email, proof или SQL-причин. */
function reject(res: Response, status: number) {
  res.status(status).json({ error: "Запрос недоступен." });
}
/** Запрещаем кеширование, проверяем флаг, JSON для POST и совпадение Origin с доверенным PUBLIC_APP_URL при его наличии. */
function ready(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.MEMBER_EMAIL_BINDING_ENABLED !== "true") {
    reject(res, 503);
    return false;
  }
  if (req.method === "POST" && !req.is("application/json")) {
    reject(res, 415);
    return false;
  }
  if (req.headers.origin) {
    try {
      if (
        req.headers.origin !==
        new URL(process.env.PUBLIC_APP_URL || "https://daryadarcy.com").origin
      ) {
        reject(res, 403);
        return false;
      }
    } catch {
      reject(res, 503);
      return false;
    }
  }
  return true;
}
/** Сопоставляем известные доменные ошибки с HTTP, неизвестную причину скрываем за временной недоступностью. */
function failure(res: Response, error: unknown) {
  const codes = {
    invalid_input: 400,
    forbidden: 403,
    recipient_unavailable: 404,
    conflict: 409,
    unavailable: 503,
  };
  reject(res, error instanceof EmailBindingError ? codes[error.code] : 503);
}
/** Резервируем до 20 запросов в заданном окне и при отказе возвращаем Retry-After вместе с 429. */
async function limited(res: Response, key: string, window: number) {
  const result = await checkRequestRateLimit(key, 20, window);
  if (result.ok) return false;
  res.setHeader("Retry-After", result.retryAfterSec);
  reject(res, 429);
  return true;
}

@Controller("api")
export class EmailBindingController {
  /** Получаем сервис текущей сессии и доменные операции привязки без смешения транспорта с SQL. */
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(EmailBindingService) private readonly bindings: EmailBindingService,
  ) {}

  /** Без чтения БД перенаправляем на страницу подтверждения доверенного сайта, сохраняя fragment токена и запрещая query. */
  @Get("auth/email-binding")
  page(@Req() req: Request, @Res() res: Response) {
    if (!ready(req, res)) return;
    // Proof остаётся во fragment браузера, а не в передаваемом серверу query.
    if (req.originalUrl.includes("?")) {
      reject(res, 400);
      return;
    }
    try {
      const target = publicAccessUrl();
      target.pathname = "/email-binding";
      // Браузер сохраняет fragment при этом redirect без нового fragment.
      // Само открытие письма не создаёт сессию и не обращается к БД.
      res.status(302).setHeader("Location", target.toString());
      res.end();
    } catch {
      reject(res, 503);
    }
  }

  /** Проверяем текущую сессию и административную роль на HTTP-границе; доменная операция повторно сверит actor под блокировкой. */
  private async administrator(req: Request, res: Response) {
    const user = await this.sessions.optionalUser(req);
    if (!user) {
      reject(res, 401);
      return null;
    }
    if (!this.sessions.isAdministrator(user)) {
      reject(res, 403);
      return null;
    }
    // Доменная операция повторно проверяет actor под текущей блокировкой БД.
    return { userId: user.id, sessionVersion: user.sessionVersion };
  }

  /** При готовой функции и лимите администратора принимаем намерение привязки и возвращаем строгую квитанцию 202 без proof. */
  @Post("admin/member-email-bindings")
  async request(@Req() req: Request, @Res() res: Response) {
    if (!ready(req, res)) return;
    try {
      const actor = await this.administrator(req, res);
      if (
        !actor ||
        (await limited(res, `email-binding-request:${actor.userId}`, 3600000))
      )
        return;
      const receipt = await this.bindings.request(actor, req.body);
      res.status(202).json(emailBindingReceiptSchema.parse(receipt));
    } catch (error) {
      failure(res, error);
    }
  }

  /** Возвращаем проверенный статус запроса текущему администратору; отсутствие заявки скрываем нейтральным 404. */
  @Get("admin/member-email-bindings/:requestKey")
  async status(@Req() req: Request, @Res() res: Response) {
    if (!ready(req, res)) return;
    try {
      const actor = await this.administrator(req, res);
      if (!actor) return;
      const status = await this.bindings.status(actor, req.params.requestKey);
      if (!status) {
        reject(res, 404);
        return;
      }
      res.status(200).json(emailBindingStatusSchema.parse(status));
    } catch (error) {
      failure(res, error);
    }
  }

  /** Ограничиваем подтверждения по IP, принимаем точный одноразовый токен JSON и возвращаем только факт успеха без авторизации пользователя. */
  @Post("auth/email-bindings/confirm")
  async confirm(@Req() req: Request, @Res() res: Response) {
    if (!ready(req, res)) return;
    if (await limited(res, `email-binding-confirm:${clientIp(req)}`, 900000)) return;
    const body = emailBindingConfirmationSchema.safeParse(req.body);
    if (!body.success) {
      reject(res, 400);
      return;
    }
    try {
      if (!(await this.bindings.confirm(body.data.token))) {
        reject(res, 400);
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      failure(res, error);
    }
  }
}
