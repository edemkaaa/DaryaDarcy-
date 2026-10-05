import express, { type Express, type Request, type Response } from "express";
import { sdk } from "./sdk";

const photoProcedures = new Set(["profile.uploadAvatar", "club.uploadCommentPhoto", "admin.uploadPhoto"]);
const jsonParsers = {
  auth: express.json({ limit: "16kb" }),
  ordinary: express.json({ limit: "256kb" }),
  photo: express.json({ limit: "6mb" }),
  media: express.json({ limit: "50mb" }),
};

async function requireUploadIdentity(req: Request, res: Response, administrator: boolean) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.blockedAt || (administrator && user.role !== "admin")) { res.status(403).json({ error: "Нет доступа" }); return false; }
    return true;
  } catch { res.status(401).json({ error: "Нужно войти" }); return false; }
}
function bodyError(res: Response, error: unknown) {
  const status = (error as { status?: number })?.status;
  const safeStatus = typeof status === "number" && status >= 400 && status < 500 ? status : 400;
  res.status(safeStatus).json({ error: safeStatus === 413 ? "Запрос слишком большой" : "Некорректный запрос" });
}

export function registerRequestBodies(app: Express) {
  app.post("/api/admin/upload-video", async (req, res, next) => {
    if (!(await requireUploadIdentity(req, res, true))) return;
    express.raw({ type: () => true, limit: "80mb" })(req, res, err => {
      if (err) { bodyError(res, err); return; }
      next();
    });
  });
  app.use(async (req, res, next) => {
    let path: string;
    try { path = decodeURIComponent(req.path); } catch { res.sendStatus(400); return; }
    const names = path.startsWith("/api/trpc/") ? path.slice("/api/trpc/".length).split(",") : [];
    const media = names.includes("admin.uploadMedia");
    const photo = names.some(name => photoProcedures.has(name));
    if ((media || photo) && !(await requireUploadIdentity(req, res, media || names.includes("admin.uploadPhoto")))) return;
    const parser = media ? jsonParsers.media : photo ? jsonParsers.photo : path.startsWith("/api/auth/") ? jsonParsers.auth : jsonParsers.ordinary;
    parser(req, res, error => { if (error) bodyError(res, error); else next(); });
  });
  const formParser = express.urlencoded({ limit: "16kb", extended: false, parameterLimit: 100 });
  const providerReturn = express.urlencoded({ limit: "2mb", extended: false, parameterLimit: 100 });
  app.use((req, res, next) => {
    const parser = /^\/api\/prodamus\/return\/?$/.test(req.path) ? providerReturn : formParser;
    parser(req, res, error => { if (error) bodyError(res, error); else next(); });
  });
}
