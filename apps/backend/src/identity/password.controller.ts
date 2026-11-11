/** HTTP-запрос и завершение восстановления, повтор письма и самостоятельная страница ввода пароля. */
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminActionKey } from "../../../../packages/shared/src/admin-action";
import { isValidEmail, normalizeEmail } from "../_core/password";
import { checkRequestRateLimit } from "../_core/request-rate-limit";
import { clientIp } from "../sms-auth";
import { PasswordService } from "./password.service";
import {
  AccessEmailStaffGuard,
  SessionAccessFilter,
  type AuthenticatedRequest,
} from "./http-access";
import { publicAccessUrl } from "./urls";

@Controller("api")
export class PasswordController {
  /** Подключаем доменный сервис доказательств и очереди вместо SQL и SMTP в HTTP-контроллере. */
  constructor(
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  /** После staff-guard ограничиваем повторы по исполнителю, принимаем строгий target/key и возвращаем 202 лишь для принятой постановки; известные конфликты сохраняют статус. */
  @Post("admin/access-email/resend")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AccessEmailStaffGuard)
  @UseFilters(SessionAccessFilter)
  async resend(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const actor = req.authenticatedUser;
      if (!(await checkRequestRateLimit(`access-resend:${actor.id}`, 20, 3600000)).ok) {
        res.sendStatus(429);
        return;
      }
      const parsed = z.object({ userId: z.number().int().positive().safe(), idempotencyKey: adminActionKey.optional() }).strict().safeParse(req.body);
      if (!parsed.success) {
        res.sendStatus(400);
        return;
      }
      const queued = await this.passwords.resend(actor, parsed.data.userId, parsed.data.idempotencyKey);
      res
        .status(queued ? 202 : 400)
        .json(
          queued
            ? { queued: true }
            : { error: "Нет доступного аккаунта с оплаченной подпиской." },
        );
    } catch (error) {
      const status = error instanceof TRPCError
        ? ({ BAD_REQUEST: 400, CONFLICT: 409, UNAUTHORIZED: 401, FORBIDDEN: 403 } as Record<string, number>)[error.code] ?? 503
        : 503;
      res.status(status).json({ error: "Запрос недоступен." });
    }
  }

  /** Ограничиваем запрос по IP и хешу почты, ставим письмо только допустимому аккаунту и возвращаем одинаковый 202 для неизвестного, заблокированного и ограниченного получателя. */
  @Post("auth/password/request")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  /** Одинаковый ответ для неизвестной почты; отправка работает через журнал получателя. */
  async request(@Req() req: Request, @Res() res: Response) {
    const email =
      typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const ipLimit = await checkRequestRateLimit(
      `password-request-ip:${clientIp(req)}`,
      10,
      900000,
    );
    if (!ipLimit.ok) {
      res
        .status(429)
        .json({ error: "Слишком много попыток. Попробуйте позже." });
      return;
    }
    try {
      if (isValidEmail(email) && email.length <= 320) {
        const emailKey = createHash("sha256").update(email).digest("hex");
        if (
          (await checkRequestRateLimit(`password-request-email:${emailKey}`, 3, 3600000)).ok
        ) {
          await this.passwords.request(email);
        }
      }
      // Same response for unknown, blocked, throttled recipients and real accounts.
      res.status(202).json({
        ok: true,
        message: "Если аккаунт доступен, мы отправим письмо с инструкцией.",
      });
    } catch {
      res
        .status(503)
        .json({ error: "Не удалось принять запрос. Попробуйте позже." });
    }
  }

  /** Ограничиваем попытки по IP и передаём токен только из JSON-тела в одноразовую смену пароля; неверное доказательство даёт 400, инфраструктурный сбой 503. */
  @Post("auth/password/complete")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  /** Принимает одноразовый proof из тела; открытие страницы само пароль не меняет. */
  async complete(@Req() req: Request, @Res() res: Response) {
    if (!(await checkRequestRateLimit(`password-complete:${clientIp(req)}`, 20, 900000)).ok) {
      res.sendStatus(429);
      return;
    }
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const ok = await this.passwords.complete(token, password);
      res.status(ok ? 200 : 400).json(
        ok
          ? { ok: true }
          : {
              error:
                "Ссылка недействительна или истекла. Пароль: от 8 до 200 символов.",
            },
      );
    } catch {
      res
        .status(503)
        .json({ error: "Не удалось сохранить пароль. Попробуйте позже." });
    }
  }

  /** Перенаправляем старую ссылку письма на доверенный экран пароля, сохраняя fragment браузером и запрещая кеш, referrer и активное содержимое промежуточной страницы. */
  @Get("auth/password")
  @Header("Cache-Control", "no-store")
  page(@Res() res: Response) {
    let destination: URL;
    try {
      destination = new URL("/password", publicAccessUrl().origin);
    } catch {
      res.status(503).type("text").send("Страница временно недоступна.");
      return;
    }
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    // No fragment in Location: browsers inherit #token from already sent emails.
    // Do not accept a redirect target from Host, query parameters or the caller.
    res.redirect(303, destination.toString());
  }
}
