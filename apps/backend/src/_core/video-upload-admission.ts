import type { Request, Response } from "express";

// express.raw holds up to 80 MiB, plus signature/storage buffers. Never queue
// another body in this process while the first one is being handled.
const active = new WeakSet<Request>();
let occupied = false;
export function admitVideoUpload(req: Request, res: Response): boolean {
  if (occupied) {
    res.setHeader("Retry-After", "2");
    res.status(429).json({ error: "Другая загрузка ещё выполняется. Повторите позже" });
    return false;
  }
  occupied = true;
  active.add(req);
  return true;
}
export function releaseVideoUpload(req: Request): void {
  if (!active.delete(req)) return;
  occupied = false;
}
