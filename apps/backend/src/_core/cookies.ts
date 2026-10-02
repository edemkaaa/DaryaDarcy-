import type { CookieOptions, Request, Response } from "express";
import {
  COOKIE_NAME,
  ONE_YEAR_MS,
} from "../../../../packages/shared/src/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

/** Old domain calculation is retained only to expire previously issued cookies. */
function legacyParentDomain(hostname: string | undefined): string | undefined {
  if (!hostname) return undefined;
  // Don't set domain for localhost or IP addresses
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Split hostname into parts
  const parts = hostname.split(".");

  // Need at least 3 parts for a subdomain (e.g., "3000-xxx.manuspre.computer")
  // For "manuspre.computer", we can't set a parent domain
  if (parts.length < 3) {
    return undefined;
  }

  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // req.protocol is resolved by Express's configured trust-proxy policy.
    secure: process.env.NODE_ENV === "production" || req.protocol === "https",
  };
}

function expireLegacySessionCookie(req: Request, res: Response): void {
  const domain = legacyParentDomain(req.hostname);
  if (domain)
    res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), domain });
}

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

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
  expireLegacySessionCookie(req, res);
}
