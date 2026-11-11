/** Ограничивает число одновременно удерживаемых больших видеотел в памяти одного API. */
import type { Request, Response } from "express";

// express.raw удерживает до 80 МиБ плюс буферы проверки и хранения. Пока
// обрабатывается одно тело, второе не ставим в очередь памяти этого процесса.
const active = new WeakSet<Request>();
let occupied = false;
/** Резервирует единственный слот большого видеотела в процессе либо возвращает 429 с коротким Retry-After без чтения тела. */
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
/** Освобождает слот лишь для действительно принятого request; повторное освобождение не затронет другую загрузку. */
export function releaseVideoUpload(req: Request): void {
  if (!active.delete(req)) return;
  occupied = false;
}
