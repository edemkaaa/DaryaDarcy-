import express, { type Express, type Request, type Response } from "express";
import { SessionService } from "../identity/session.service";
import { privateVideoMetadata, privateVideoUploadEnabled } from "../content/private-video-input";
import { retiredPublicUploads, retiredUploadMessage } from "../media/legacy-upload-policy";

const photoProcedures = new Set(["profile.uploadAvatar", "profile.uploadAvatarWithReceipt", "club.uploadPrivateCommentPhoto", "admin.uploadPhoto", "admin.uploadPublicCover"]);
const sessions = new SessionService();
export const MEDIA_JSON_BODY_LIMIT = 50 * 1024 * 1024;
const streamedMediaRequests = new WeakSet<Request>();
const jsonParsers = {
  auth: express.json({ limit: "16kb" }),
  ordinary: express.json({ limit: "256kb" }),
  photo: express.json({ limit: "6mb" }),
  media: express.json({ limit: MEDIA_JSON_BODY_LIMIT }),
};

async function requireUploadIdentity(req: Request, res: Response, administrator: boolean) {
  try {
    const user = await sessions.optionalUser(req);
    if (!user) { res.status(401).json({ error: "Нужно войти" }); return false; }
    if (user.blockedAt || (administrator && user.role !== "admin")) { res.status(403).json({ error: "Нет доступа" }); return false; }
    return true;
  } catch { res.status(503).json({ error: "Проверка сессии временно недоступна" }); return false; }
}
function bodyError(res: Response, error: unknown) {
  const status = (error as { status?: number })?.status;
  const safeStatus = typeof status === "number" && status >= 400 && status < 500 ? status : 400;
  res.status(safeStatus).json({ error: safeStatus === 413 ? "Запрос слишком большой" : "Некорректный запрос" });
}

function isProviderWebhook(req: Request): boolean {
  return /^\/api\/prodamus\/webhook\/?$/.test(req.path) &&
    (req.method === "GET" || req.method === "HEAD" || req.method === "POST");
}

export function registerRequestBodies(app: Express) {
  app.post("/api/admin/private-video-uploads", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!privateVideoUploadEnabled()) { res.status(404).json({ error: "Загрузка недоступна" }); return; }
    if (!(await requireUploadIdentity(req, res, true))) return;
    if (!privateVideoMetadata.safeParse({ query: req.query, idempotencyKey: req.headers["idempotency-key"], mimeType: req.headers["content-type"] ?? "application/octet-stream" }).success) {
      res.status(400).json({ error: "Некорректный запрос" }); return;
    }
    express.raw({ type: () => true, limit: "80mb", inflate: false })(req, res, err => {
      if (err) { bodyError(res, err); return; }
      next();
    });
  });
  app.post("/api/admin/upload-video", (_req, res) => {
    res.status(404).json({ error: retiredUploadMessage });
  });
  app.use(async (req, res, next) => {
    // POST has its bounded raw parser; GET/its implicit HEAD use query only.
    // Ordinary JSON/form parsers must not change what the provider signature binds.
    if (isProviderWebhook(req)) { next(); return; }
    let path: string;
    try { path = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
    const names = path.startsWith("/api/trpc/") ? path.slice("/api/trpc/".length).split(",") : [];
    // Reject amplification before parsing a body or entering any procedure.
    if (names.length > 20 || names.filter(name => name === "feed.list").length > 1) {
      res.status(400).json({ error: "Слишком много операций в запросе" }); return;
    }
    if (names.some(name => retiredPublicUploads.has(name.replace(/\/$/, "")))) {
      res.status(404).json({ error: retiredUploadMessage }); return;
    }
    const privateUpload = names.includes("admin.uploadPrivateAttachment");
    if (privateUpload && process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED !== "true") { res.status(404).json({ error: "Загрузка недоступна" }); return; }
    const privateContentUpload = names.includes("admin.uploadPrivateContentFile") || names.includes("club.uploadPrivateCommentPhoto");
    if (privateContentUpload && process.env.PRIVATE_CONTENT_FILES_ENABLED !== "true") { res.status(404).json({ error: "Загрузка недоступна" }); return; }
    // Base64 envelopes need room above the existing decoded 4/32 MiB quotas.
    const media = privateUpload || names.includes("admin.uploadPrivateContentFile");
    const photo = names.some(name => photoProcedures.has(name));
    if ((media || photo) && !(await requireUploadIdentity(req, res, media || names.includes("admin.uploadPhoto") || names.includes("admin.uploadPublicCover")))) return;
    // tRPC 11 stringifies an Express-parsed object and parses it again. Let its
    // bounded stream reader handle standard UTF-8 JSON once, after admission.
    // Other charsets/compressed bodies retain the existing Express JSON path.
    if (media && req.method === "POST" &&
        /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(req.headers["content-type"] ?? "") &&
        (!req.headers["content-encoding"] || req.headers["content-encoding"] === "identity")) {
      if (Number(req.headers["content-length"]) > MEDIA_JSON_BODY_LIMIT) {
        bodyError(res, { status: 413 }); req.resume(); return;
      }
      streamedMediaRequests.add(req);
      next(); return;
    }
    const parser = media ? jsonParsers.media : photo ? jsonParsers.photo : path.startsWith("/api/auth/") ? jsonParsers.auth : jsonParsers.ordinary;
    parser(req, res, error => { if (error) bodyError(res, error); else next(); });
  });
  const formParser = express.urlencoded({ limit: "16kb", extended: false, parameterLimit: 100 });
  const providerReturn = express.urlencoded({ limit: "2mb", extended: false, parameterLimit: 100 });
  app.use((req, res, next) => {
    // urlencoded() otherwise creates req.body={} even for JSON, hiding the
    // unread stream from tRPC's Node adapter.
    if (isProviderWebhook(req) || streamedMediaRequests.has(req)) { next(); return; }
    const parser = /^\/api\/prodamus\/return\/?$/.test(req.path) ? providerReturn : formParser;
    parser(req, res, error => { if (error) bodyError(res, error); else next(); });
  });
}
