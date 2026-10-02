import { COOKIE_NAME, ONE_YEAR_MS } from "../../../../packages/shared/src/const.js";
import type { Express, Request, Response } from "express";
import {
  emailToOpenId,
  getUserByEmail,
  getUserByOpenId,
  getUserByPhone,
  isOwnerAccount,
  phoneToOpenId,
  upsertUser,
} from "../db";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from "./password";
import { sdk } from "./sdk";
import type { User } from "../../../../packages/database/src/schema";
import { normalizeRuPhone } from "../../../../packages/shared/src/phone";
import { clientIp, consumeSmsCode, issueSmsCode } from "../sms-auth";
import { checkRateLimit } from "./rate-limit";
import { logUserConsent } from "../platform-db";
import {
  EMAIL_REGISTER_CONSENT_KEY,
  EMAIL_REGISTER_CONSENT_TEXT,
  EMAIL_REGISTER_CONSENT_VERSION,
  SMS_LOGIN_CONSENT_KEY,
  SMS_LOGIN_CONSENT_TEXT,
  SMS_LOGIN_CONSENT_VERSION,
} from "../../../../packages/shared/src/consent-texts";
import { adminTotpEnabled, verifyTotp } from "./totp";

function isStaffUser(user: Pick<User, "role" | "email" | "openId">): boolean {
  return isOwnerAccount(user) || user.role === "admin" || user.role === "moderator";
}

function verifyStaffTotp(req: Request, res: Response): boolean {
  if (!adminTotpEnabled()) return true;
  const totp = typeof req.body?.totp === "string" ? req.body.totp.trim() : "";
  if (!totp) {
    res.status(403).json({ error: "Введите код двухфакторной аутентификации", requiresTotp: true });
    return false;
  }
  const secret = (process.env.ADMIN_TOTP_SECRET || "").trim();
  if (!verifyTotp(secret, totp)) {
    res.status(401).json({ error: "Неверный код 2FA", requiresTotp: true });
    return false;
  }
  return true;
}

function publicUser(user: User | { openId?: string | null; name?: string | null; email?: string | null; phone?: string | null; loginMethod?: string | null; lastSignedIn?: Date | null; id?: number | null; role?: string | null; gender?: "female" | "male" | null; avatarUrl?: string | null }) {
  return {
    id: (user as User).id ?? null,
    openId: user.openId ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    phone: (user as User).phone ?? null,
    loginMethod: user.loginMethod ?? null,
    gender: (user as User).gender ?? null,
    avatarUrl: (user as User).avatarUrl ?? null,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
    role: (user as User).role ?? "user",
  };
}

export async function issueSession(req: Request, res: Response, user: User) {
  if(user.blockedAt) throw new Error("Account unavailable");
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || user.email || user.phone || "",
    expiresInMs: ONE_YEAR_MS,
    sessionVersion: user.sessionVersion,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  return { sessionToken, user: publicUser(user) };
}

async function optionalSessionUser(req: Request): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

function smsErrorStatus(message: string): number {
  if (
    message.includes("Подождите") ||
    message.includes("Слишком много") ||
    message.includes("лимит SMS")
  ) {
    return 429;
  }
  if (message.includes("временно недоступен") || message.includes("База недоступна")) return 503;
  return 400;
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const ip = clientIp(req);
      const limited = checkRateLimit(`auth:register:${ip}`, 15, 15 * 60_000);
      if (!limited.ok) {
        res.status(429).json({ error: "Слишком много попыток. Попробуйте позже.", retryAfterSec: limited.retryAfterSec });
        return;
      }
      const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const consentVersion =
        typeof req.body?.consentVersion === "string" ? req.body.consentVersion.trim() : "";

      if (!consentVersion) {
        res.status(400).json({ error: "Подтвердите согласие на обработку персональных данных" });
        return;
      }

      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Укажите корректный email" });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "Пароль должен быть не короче 8 символов" });
        return;
      }
      if (password.length > 200) {
        res.status(400).json({ error: "Пароль слишком длинный" });
        return;
      }

      const existing = await getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Этот email уже зарегистрирован. Войдите." });
        return;
      }

      const openId = emailToOpenId(email);
      const passwordHash = await hashPassword(password);
      const role = "user";

      await upsertUser({
        openId,
        email,
        name: name || null,
        loginMethod: "email",
        passwordHash,
        role,
        lastSignedIn: new Date(),
      });

      const user = await getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Не удалось создать аккаунт" });
        return;
      }

      await logUserConsent(
        user.id,
        EMAIL_REGISTER_CONSENT_KEY,
        "granted",
        consentVersion || EMAIL_REGISTER_CONSENT_VERSION,
        EMAIL_REGISTER_CONSENT_TEXT,
      );

      const session = await issueSession(req, res, user);
      res.json(session);
    } catch (error) {
      console.error("[Auth] Register failed", error);
      res.status(500).json({ error: "Не удалось создать аккаунт" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const ip = clientIp(req);
      const limited = checkRateLimit(`auth:login:${ip}`, 20, 15 * 60_000);
      if (!limited.ok) {
        res.status(429).json({ error: "Слишком много попыток. Попробуйте позже.", retryAfterSec: limited.retryAfterSec });
        return;
      }
      const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!isValidEmail(email) || password.length < 1) {
        res.status(400).json({ error: "Неверный email или пароль" });
        return;
      }

      const user = await getUserByEmail(email);
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: "Неверный email или пароль" });
        return;
      }

      if (isStaffUser(user) && !verifyStaffTotp(req, res)) return;

      await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const session = await issueSession(req, res, user);
      res.json(session);
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Не удалось войти" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: publicUser(user) });
    } catch {
      res.json({ user: null });
    }
  });

  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: publicUser(user) });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/sms/send", async (req: Request, res: Response) => {
    try {
      const phone = normalizeRuPhone(typeof req.body?.phone === "string" ? req.body.phone : "");
      if (!phone) {
        res.status(400).json({ error: "Укажите российский номер: +7 9XX XXX-XX-XX" });
        return;
      }
      const issued = await issueSmsCode(phone, clientIp(req));
      res.json({ ok: true, retryAfterSec: issued.retryAfterSec });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить SMS";
      const retryAfterSec = (error as Error & { retryAfterSec?: number }).retryAfterSec;
      console.error("[Auth] SMS send failed", message);
      res.status(smsErrorStatus(message)).json({ error: message, retryAfterSec });
    }
  });

  app.post("/api/auth/sms/verify", async (req: Request, res: Response) => {
    try {
      const phone = normalizeRuPhone(typeof req.body?.phone === "string" ? req.body.phone : "");
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      const consentVersion =
        typeof req.body?.consentVersion === "string" ? req.body.consentVersion.trim() : "";
      if (!phone || !/^\d{4,6}$/.test(code)) {
        res.status(400).json({ error: "Укажите номер и код из SMS" });
        return;
      }

      const finishSmsSession = async (user: User) => {
        const session = await issueSession(req, res, user);
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

      const sessionUser = await optionalSessionUser(req);
      const existing = await getUserByPhone(phone);

      if (existing) {
        if (sessionUser && sessionUser.id !== existing.id) {
          res.status(409).json({ error: "Этот номер уже привязан к другому аккаунту" });
          return;
        }
        if (isStaffUser(existing) && !verifyStaffTotp(req, res)) return;
        await consumeSmsCode(phone, code, clientIp(req));
        await upsertUser({ openId: existing.openId, lastSignedIn: new Date() });
        await finishSmsSession(existing);
        return;
      }

      if (sessionUser) {
        if (isStaffUser(sessionUser) && !verifyStaffTotp(req, res)) return;
        await consumeSmsCode(phone, code, clientIp(req));
        await upsertUser({
          openId: sessionUser.openId,
          phone,
          lastSignedIn: new Date(),
        });
        const updated = await getUserByOpenId(sessionUser.openId);
        if (!updated) {
          res.status(500).json({ error: "Не удалось сохранить номер" });
          return;
        }
        await finishSmsSession(updated);
        return;
      }

      await consumeSmsCode(phone, code, clientIp(req));

      const openId = phoneToOpenId(phone);
      await upsertUser({
        openId,
        phone,
        name: null,
        loginMethod: "sms",
        lastSignedIn: new Date(),
      });
      const user = await getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Не удалось создать аккаунт" });
        return;
      }
      await finishSmsSession(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось войти";
      if (message.includes("Duplicate") && message.toLowerCase().includes("phone")) {
        res.status(409).json({ error: "Этот номер уже привязан к другому аккаунту" });
        return;
      }
      console.error("[Auth] SMS verify failed", message);
      res.status(smsErrorStatus(message)).json({ error: message });
    }
  });
}
