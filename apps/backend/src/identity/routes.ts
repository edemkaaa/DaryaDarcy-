import type { Express } from "express";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../db";
import { isValidEmail, normalizeEmail } from "../_core/password";
import { checkRateLimit } from "../_core/rate-limit";
import { clientIp } from "../sms-auth";
import {
  completePassword,
  requestPasswordEmail,
  resendClubAccess,
} from "./access";
import { sdk } from "../_core/sdk";
import { publicAccessUrl } from "./urls";

export function registerPasswordRoutes(app: Express) {
  app.post("/api/admin/access-email/resend", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.is("application/json")) {
      res.sendStatus(415);
      return;
    }
    try {
      const origin = req.headers.origin;
      if (
        origin &&
        origin !==
          new URL(process.env.PUBLIC_APP_URL || "https://daryadarcy.com").origin
      ) {
        res.sendStatus(403);
        return;
      }
      const actor = await sdk.authenticateRequest(req);
      if (!["admin", "moderator"].includes(actor.role)) {
        res.sendStatus(403);
        return;
      }
      if (!checkRateLimit(`access-resend:${actor.id}`, 20, 3600000).ok) {
        res.sendStatus(429);
        return;
      }
      const userId = req.body?.userId;
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        res.sendStatus(400);
        return;
      }
      const database = await getDb();
      if (!database) throw new Error("Database unavailable");
      const queued = await resendClubAccess(database, actor.id, userId);
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
  });
  app.post("/api/auth/password/request", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const email =
      typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const emailKey = createHash("sha256").update(email).digest("hex");
    const ipLimit = checkRateLimit(
      `password-request-ip:${clientIp(req)}`,
      10,
      900000,
    );
    const emailLimit = checkRateLimit(
      `password-request-email:${emailKey}`,
      3,
      3600000,
    );
    if (!ipLimit.ok) {
      res
        .status(429)
        .json({ error: "Слишком много попыток. Попробуйте позже." });
      return;
    }
    try {
      if (emailLimit.ok && isValidEmail(email) && email.length <= 320) {
        const database = await getDb();
        if (!database) throw new Error("Database unavailable");
        await requestPasswordEmail(database, email);
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
  });
  app.post("/api/auth/password/complete", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!checkRateLimit(`password-complete:${clientIp(req)}`, 20, 900000).ok) {
      res.sendStatus(429);
      return;
    }
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const database = await getDb();
      if (!database) throw new Error("Database unavailable");
      const ok = await completePassword(database, token, password);
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
  });
  app.get("/api/auth/password", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let loginUrl: string;
    try {
      loginUrl = publicAccessUrl()
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    } catch {
      res.status(503).type("text").send("Страница временно недоступна.");
      return;
    }
    const nonce = randomBytes(16).toString("base64");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    );
    res
      .type("html")
      .send(
        `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Пароль DARYADARCY</title><style>body{font:18px system-ui;max-width:480px;margin:60px auto;padding:20px}input,button{font:inherit;padding:12px;margin:10px 0;width:100%;box-sizing:border-box}</style><h1>Установить пароль</h1><form id="form"><label>Новый пароль<input id="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" required></label><button>Сохранить</button></form><p id="result" role="status"></p><a href="${loginUrl}">Перейти ко входу</a><script nonce="${nonce}">const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';history.replaceState(null,'',location.pathname);document.getElementById('form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const r=await fetch('/api/auth/password/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:document.getElementById('password').value})});const data=await r.json();document.getElementById('result').textContent=r.ok?'Пароль сохранён. Войдите в аккаунт.':data.error||'Попробуйте позже.';if(r.ok)e.target.remove();}catch{document.getElementById('result').textContent='Нет соединения. Попробуйте ещё раз.';}finally{button.disabled=false;}});</script></html>`,
      );
  });
}
