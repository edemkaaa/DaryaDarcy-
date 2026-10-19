import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { phoneToOpenId } from "../db";
import { clearSessionCookie, setSessionCookie } from "../_core/cookies";
import { isValidEmail, normalizeEmail } from "../_core/password";
import type { User } from "../../../../packages/database/src/schema";
import { normalizeRuPhone } from "../../../../packages/shared/src/phone";
import { clientIp, consumeSmsCode, issueSmsCode } from "../sms-auth";
import { getCapabilities } from "../launch/capabilities";
import { checkRateLimit } from "../_core/rate-limit";
import { logUserConsent } from "../platform-db";
import {
  EMAIL_REGISTER_CONSENT_VERSION,
  SMS_LOGIN_CONSENT_KEY,
  SMS_LOGIN_CONSENT_TEXT,
  SMS_LOGIN_CONSENT_VERSION,
} from "../../../../packages/shared/src/consent-texts";
import { adminTotpEnabled, verifyTotp } from "../_core/totp";
import { publicUser, SessionService } from "./session.service";

function verifyStaffTotp(req: Request, res: Response): boolean {
  if (!adminTotpEnabled()) return true;
  const totp = typeof req.body?.totp === "string" ? req.body.totp.trim() : "";
  if (!totp) {
    res
      .status(403)
      .json({
        error: "Введите код двухфакторной аутентификации",
        requiresTotp: true,
      });
    return false;
  }
  const secret = (process.env.ADMIN_TOTP_SECRET || "").trim();
  if (!verifyTotp(secret, totp)) {
    res.status(401).json({ error: "Неверный код 2FA", requiresTotp: true });
    return false;
  }
  return true;
}

function smsErrorStatus(message: string): number {
  if (
    message.includes("Подождите") ||
    message.includes("Слишком много") ||
    message.includes("лимит SMS")
  ) {
    return 429;
  }
  if (
    message.includes("временно недоступен") ||
    message.includes("База недоступна")
  )
    return 503;
  return 400;
}

@Controller("api/auth")
export class SessionController {
  constructor(
    @Inject(SessionService) private readonly identity: SessionService,
  ) {}

  private async issueSession(req: Request, res: Response, user: User) {
    const session = await this.identity.issueSession(user);
    setSessionCookie(req, res, session.sessionToken);
    return session;
  }

  @Post("register")
  @HttpCode(200)
  async register(@Req() req: Request, @Res() res: Response) {
    try {
      const ip = clientIp(req);
      const limited = checkRateLimit(`auth:register:${ip}`, 15, 15 * 60_000);
      if (!limited.ok) {
        res
          .status(429)
          .json({
            error: "Слишком много попыток. Попробуйте позже.",
            retryAfterSec: limited.retryAfterSec,
          });
        return;
      }
      const email =
        typeof req.body?.email === "string"
          ? normalizeEmail(req.body.email)
          : "";
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const consentVersion =
        typeof req.body?.consentVersion === "string"
          ? req.body.consentVersion.trim()
          : "";

      if (consentVersion !== EMAIL_REGISTER_CONSENT_VERSION) {
        res
          .status(400)
          .json({
            error: "Подтвердите согласие на обработку персональных данных",
          });
        return;
      }

      if (!isValidEmail(email) || email.length > 320) {
        res.status(400).json({ error: "Укажите корректный email" });
        return;
      }

      const outcome = await this.identity.register(email, name);
      if (outcome === "duplicate") {
        res
          .status(409)
          .json({ error: "Этот email уже зарегистрирован. Войдите." });
        return;
      }

      if (outcome === "unavailable") {
        res.status(503).json({ error: "Регистрация временно недоступна" });
        return;
      }
      res
        .status(202)
        .json({
          ok: true,
          message:
            "Запрос принят. Проверьте почту: в письме будет ссылка для установки пароля.",
        });
    } catch (error) {
      console.error("[Auth] Register failed");
      res.status(500).json({ error: "Не удалось создать аккаунт" });
    }
  }

  @Post("login")
  @HttpCode(200)
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      const ip = clientIp(req);
      const limited = checkRateLimit(`auth:login:${ip}`, 20, 15 * 60_000);
      if (!limited.ok) {
        res
          .status(429)
          .json({
            error: "Слишком много попыток. Попробуйте позже.",
            retryAfterSec: limited.retryAfterSec,
          });
        return;
      }
      const email =
        typeof req.body?.email === "string"
          ? normalizeEmail(req.body.email)
          : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!isValidEmail(email) || password.length < 1) {
        res.status(400).json({ error: "Неверный email или пароль" });
        return;
      }

      const user = await this.identity.passwordUser(email, password);
      if (!user) {
        res.status(401).json({ error: "Неверный email или пароль" });
        return;
      }

      if (this.identity.isStaff(user) && !verifyStaffTotp(req, res)) return;

      await this.identity.updateUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
      const session = await this.issueSession(req, res, user);
      res.json(session);
    } catch (error) {
      console.error("[Auth] Login failed");
      res.status(500).json({ error: "Не удалось войти" });
    }
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Req() req: Request, @Res() res: Response) {
    clearSessionCookie(req, res);
    res.json({ success: true });
  }

  @Get("me")
  async me(@Req() req: Request, @Res() res: Response) {
    const user = await this.identity.optionalUser(req);
    res.json({ user: user ? publicUser(user) : null });
  }

  @Post("session")
  @HttpCode(200)
  async session(@Req() req: Request, @Res() res: Response) {
    const user = await this.identity.optionalUser(req);
    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      res.status(400).json({ error: "Bearer token required" });
      return;
    }
    const token = authHeader.slice("Bearer ".length).trim();
    setSessionCookie(req, res, token);
    res.json({ success: true, user: publicUser(user) });
  }

  @Post("sms/send")
  @HttpCode(200)
  async sendSms(@Req() req: Request, @Res() res: Response) {
    if (!getCapabilities().smsLogin) {
      res
        .status(503)
        .json({
          code: "FEATURE_DISABLED",
          error: "Вход по SMS пока недоступен",
        });
      return;
    }
    try {
      const phone = normalizeRuPhone(
        typeof req.body?.phone === "string" ? req.body.phone : "",
      );
      if (!phone) {
        res
          .status(400)
          .json({ error: "Укажите российский номер: +7 9XX XXX-XX-XX" });
        return;
      }
      const issued = await issueSmsCode(phone, clientIp(req));
      res.json({ ok: true, retryAfterSec: issued.retryAfterSec });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось отправить SMS";
      const retryAfterSec = (error as Error & { retryAfterSec?: number })
        .retryAfterSec;
      console.error("[Auth] SMS send failed", message);
      res
        .status(smsErrorStatus(message))
        .json({ error: message, retryAfterSec });
    }
  }

  @Post("sms/verify")
  @HttpCode(200)
  async verifySms(@Req() req: Request, @Res() res: Response) {
    if (!getCapabilities().smsLogin) {
      res
        .status(503)
        .json({
          code: "FEATURE_DISABLED",
          error: "Вход по SMS пока недоступен",
        });
      return;
    }
    try {
      const phone = normalizeRuPhone(
        typeof req.body?.phone === "string" ? req.body.phone : "",
      );
      const code =
        typeof req.body?.code === "string" ? req.body.code.trim() : "";
      const consentVersion =
        typeof req.body?.consentVersion === "string"
          ? req.body.consentVersion.trim()
          : "";
      if (!phone || !/^\d{4,6}$/.test(code)) {
        res.status(400).json({ error: "Укажите номер и код из SMS" });
        return;
      }

      const finishSmsSession = async (user: User) => {
        const session = await this.issueSession(req, res, user);
        if (consentVersion && user.id) {
          void logUserConsent(
            user.id,
            SMS_LOGIN_CONSENT_KEY,
            "granted",
            consentVersion || SMS_LOGIN_CONSENT_VERSION,
            SMS_LOGIN_CONSENT_TEXT,
          );
        }
        res.json(session);
      };

      const sessionUser = await this.identity.optionalUser(req);
      const existing = await this.identity.findByPhone(phone);

      if (existing) {
        if (sessionUser && sessionUser.id !== existing.id) {
          res
            .status(409)
            .json({ error: "Этот номер уже привязан к другому аккаунту" });
          return;
        }
        if (this.identity.isStaff(existing) && !verifyStaffTotp(req, res))
          return;
        await consumeSmsCode(phone, code, clientIp(req));
        await this.identity.updateUser({
          openId: existing.openId,
          lastSignedIn: new Date(),
        });
        await finishSmsSession(existing);
        return;
      }

      if (sessionUser) {
        if (this.identity.isStaff(sessionUser) && !verifyStaffTotp(req, res))
          return;
        await consumeSmsCode(phone, code, clientIp(req));
        await this.identity.updateUser({
          openId: sessionUser.openId,
          phone,
          lastSignedIn: new Date(),
        });
        const updated = await this.identity.findByOpenId(sessionUser.openId);
        if (!updated) {
          res.status(500).json({ error: "Не удалось сохранить номер" });
          return;
        }
        await finishSmsSession(updated);
        return;
      }

      await consumeSmsCode(phone, code, clientIp(req));

      const openId = phoneToOpenId(phone);
      await this.identity.updateUser({
        openId,
        phone,
        name: null,
        loginMethod: "sms",
        lastSignedIn: new Date(),
      });
      const user = await this.identity.findByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Не удалось создать аккаунт" });
        return;
      }
      await finishSmsSession(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось войти";
      if (
        message.includes("Duplicate") &&
        message.toLowerCase().includes("phone")
      ) {
        res
          .status(409)
          .json({ error: "Этот номер уже привязан к другому аккаунту" });
        return;
      }
      console.error("[Auth] SMS verify failed", message);
      res.status(smsErrorStatus(message)).json({ error: message });
    }
  }
}
