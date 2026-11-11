/** Устанавливает общие HTTP-заголовки и правила доверия запросам на входе API. */
import type { Express } from "express";
import { registerPublicResponseCompression } from "./public-response-compression";

/** Проверяет configured browser origins, задаёт no-store/CORS/security headers и отсекает недоверенные cross-site или сжатые тела до парсеров. */
export function registerHttpSecurity(app: Express): void {
  const origins = new Set<string>();
  const configured = [process.env.PUBLIC_APP_URL || "https://daryadarcy.com", ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",").filter(Boolean)];
  for (const value of configured) {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
      throw new Error("Invalid configured browser origin");
    }
    origins.add(url.origin);
  }
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.vary("Origin");
    // Ответ изменения может содержать гостевую ссылку оплаты даже без cookie.
    if ((req.method === "POST" && req.path.startsWith("/api/")) || /^\/api\/auth(?:\/|$)/.test(req.path) || /^\/api\/admin\/member-email-bindings(?:\/|$)/i.test(req.path) || req.headers.cookie || req.headers.authorization) {
      res.setHeader("Cache-Control", "no-store");
    }
    // Отказ выдачи файла возможен ещё здесь, до контроллера, и тоже не должен кэшироваться.
    if (/^\/api\/media\/(?:post-attachments|content-files)(?:\/|$)/.test(req.path)) {
      res.setHeader("Cache-Control", "private, no-store");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (process.env.NODE_ENV === "production" && req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const origin = req.headers.origin;
    const trusted = Boolean(origin && origins.has(origin));
    // Исключены только точные платёжные маршруты: webhook проверяет HMAC,
    // а return перенаправляет браузер без выдачи доступа или сессии.
    const providerBoundary = /^\/api\/prodamus\/(webhook|return)\/?$/.test(req.path) && ["GET", "POST"].includes(req.method);
    if (origin && !trusted && !providerBoundary) { res.sendStatus(403); return; }
    if (!origin && !providerBoundary) {
      // Из письма разрешена навигация на эти страницы только для чтения.
      // Изменения, cross-site fetch и встроенные документы исключением не пользуются.
      const emailPageNavigation = req.method === "GET" &&
        /^\/api\/auth\/(password|email-binding)\/?$/.test(req.path) &&
        req.headers["sec-fetch-mode"] === "navigate" &&
        req.headers["sec-fetch-dest"] === "document";
      const simpleContent = /^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)(;|$)/i.test(req.headers["content-type"] || "");
      if ((req.headers["sec-fetch-site"] === "cross-site" && !emailPageNavigation) ||
          (req.headers.cookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && simpleContent)) {
        res.sendStatus(403); return;
      }
    }
    if (trusted) {
      res.header("Access-Control-Allow-Origin", origin!);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, Idempotency-Key");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") { res.sendStatus(200); return; }
    // Контракт не требует сжатых тел: отклоняем их до любого парсера,
    // поскольку GHSA-27r3-jxmh-p828 может аварийно завершить активный декодер.
    if ((req.headers["content-encoding"] ?? "identity").trim().toLowerCase() !== "identity") {
      res.status(415).json({ error: "Сжатые запросы не поддерживаются" });
      return;
    }
    next();
  });
  registerPublicResponseCompression(app);
}
