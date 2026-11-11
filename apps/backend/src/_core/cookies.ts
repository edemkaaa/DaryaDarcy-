/** Выдаёт host-only cookie сессии и удаляет также старые доменные варианты при переходе. */
import type { CookieOptions, Request, Response } from "express";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
} from "../../../../packages/shared/src/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Отличает IPv4/IPv6 от доменного hostname только для удаления старой доменной cookie. */
function isIpAddress(host: string) {
  // Для старой доменной cookie достаточно отличить IP от доменного имени.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

/** Старое вычисление домена нужно только для удаления ранее выданных cookie. */
function legacyParentDomain(hostname: string | undefined): string | undefined {
  if (!hostname) return undefined;
  // Для localhost и IP старый домен cookie не вычисляется.
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Ниже сохраняется только историческое правило вычисления родительского домена.
  const parts = hostname.split(".");

  // Родительский домен вычислялся только для hostname из трёх и более частей.
  // Правило используется для удаления старой cookie, а не для новой выдачи.
  if (parts.length < 3) {
    return undefined;
  }

  return "." + parts.slice(-2).join(".");
}

/** Новая cookie ограничена текущим хостом; secure определяется серверным контекстом запроса. */
export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // req.protocol определяется настройкой доверия Express к reverse proxy.
    secure: process.env.NODE_ENV === "production" || req.protocol === "https",
  };
}

/** Удаляет прежнюю parent-domain cookie, не распространяя новую сессию на соседние поддомены. */
function expireLegacySessionCookie(req: Request, res: Response): void {
  const domain = legacyParentDomain(req.hostname);
  if (domain)
    res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), domain });
}

/** Перед новой host-only сессией удаляет старую доменную cookie; выставляет HttpOnly и годовой срок. */
export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
): void {
  expireLegacySessionCookie(req, res);
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

/** Очищает текущую cookie и исторические варианты, не создавая новую сессию. */
export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
  expireLegacySessionCookie(req, res);
}
