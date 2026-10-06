import type { Express } from "express";

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
    if (/^\/api\/auth(?:\/|$)/.test(req.path) || req.headers.cookie || req.headers.authorization) {
      res.setHeader("Cache-Control", "no-store");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (process.env.NODE_ENV === "production" && req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const origin = req.headers.origin;
    const trusted = Boolean(origin && origins.has(origin));
    // Only these exact payment boundaries are exempt: webhook checks HMAC;
    // browser return redirects and must never grant access or issue a session.
    const providerBoundary = /^\/api\/prodamus\/(webhook|return)\/?$/.test(req.path) && ["GET", "POST"].includes(req.method);
    if (origin && !trusted && !providerBoundary) { res.sendStatus(403); return; }
    if (!origin && !providerBoundary) {
      // Email links may open this public, read-only form. Do not exempt its
      // password mutations, cross-site fetches or embedded documents.
      const passwordPageNavigation = req.method === "GET" &&
        /^\/api\/auth\/password\/?$/.test(req.path) &&
        req.headers["sec-fetch-mode"] === "navigate" &&
        req.headers["sec-fetch-dest"] === "document";
      const simpleContent = /^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)(;|$)/i.test(req.headers["content-type"] || "");
      if ((req.headers["sec-fetch-site"] === "cross-site" && !passwordPageNavigation) ||
          (req.headers.cookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && simpleContent)) {
        res.sendStatus(403); return;
      }
    }
    if (trusted) {
      res.header("Access-Control-Allow-Origin", origin!);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") { res.sendStatus(200); return; }
    next();
  });
}
