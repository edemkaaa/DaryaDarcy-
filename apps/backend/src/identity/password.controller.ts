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
import { isValidEmail, normalizeEmail } from "../_core/password";
import { checkRateLimit } from "../_core/rate-limit";
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
  constructor(
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  @Post("admin/access-email/resend")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(AccessEmailStaffGuard)
  @UseFilters(SessionAccessFilter)
  async resend(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const actor = req.authenticatedUser;
      if (!checkRateLimit(`access-resend:${actor.id}`, 20, 3600000).ok) {
        res.sendStatus(429);
        return;
      }
      const userId = req.body?.userId;
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        res.sendStatus(400);
        return;
      }
      const queued = await this.passwords.resend(actor.id, userId);
      res
        .status(queued ? 202 : 400)
        .json(
          queued
            ? { queued: true }
            : { error: "Нет доступного аккаунта с оплаченной подпиской." },
        );
    } catch {
      res.status(403).json({ error: "Запрос недоступен." });
    }
  }

  @Post("auth/password/request")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async request(@Req() req: Request, @Res() res: Response) {
    const email =
      typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const ipLimit = checkRateLimit(
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
          checkRateLimit(`password-request-email:${emailKey}`, 3, 3600000).ok
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

  @Post("auth/password/complete")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async complete(@Req() req: Request, @Res() res: Response) {
    if (!checkRateLimit(`password-complete:${clientIp(req)}`, 20, 900000).ok) {
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
