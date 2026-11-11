/** Потоковая HTTP-граница закрытых вложений: проверка доступа предшествует чтению хранилища. */
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrivateFilesService } from "./private-files.service";
import { privateObjectReader } from "../media/private-object";

// Keep generic labels, not uploaded filenames or storage paths. Use the stored
// MIME so normalized photos receive .webp, regardless of the original filename.
const DOWNLOAD_EXTENSIONS = new Map([
  ["text/plain", "txt"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/ogg", "ogg"],
  ["audio/webm", "webm"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
]);

/** One safe integer byte range; undefined means invalid/unsatisfiable. */
/** Разбираем единственный безопасный диапазон байтов, включая суффикс; пустые, множественные, переполненные и недостижимые диапазоны отклоняются. */
function byteRange(raw: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
  if (!match || (!match[1] && !match[2]) || size === 0) return;
  const first = Number(match[1]),
    last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return;
  if (!match[1]) {
    if (last === 0) return;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const end = match[2] ? Math.min(last, size - 1) : size - 1;
  if (first >= size || end < first) return;
  return { start: first, end };
}

@Controller("api/media/post-attachments")
export class PrivateFilesController {
  /** Подключаем проверку опубликованного родителя и квитанции вложения до обращения к хранилищу. */
  constructor(
    @Inject(PrivateFilesService) private readonly files: PrivateFilesService,
  ) {}

  /** Проверяем серверный флаг, положительный числовой ID и отсутствие параметров; защищённую передачу GET/HEAD выполняет общий обработчик. */
  @Get(":mediaId")
  // Express GET registration also handles HEAD; verify with the native route.
  async read(
    @Param("mediaId") rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    /** Отвечаем одинаковым 404 для некорректного или выключенного маршрута, не подтверждая существование вложения. */
    const unavailable = () =>
      res.status(404).json({ error: "Файл недоступен." });
    const id = Number(rawId);
    if (
      process.env.PRIVATE_POST_MEDIA_DELIVERY_ENABLED !== "true" ||
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id) ||
      Object.keys(req.query).length
    )
      return unavailable();
    return sendPrivateFile(req, res, () => this.files.authorizedAttachment(id, req), `attachment-${id}`);
  }
}

/** Shared streaming boundary: authorization resolves before any storage request. */
/** Сначала разрешаем доступ, затем сверяем HEAD/ETag и условный GET, поддерживаем один Range и передаём поток с отменой при закрытии клиента и простое; приватный ответ не кешируется. */
export async function sendPrivateFile(req: Request, res: Response,
  resolve: () => Promise<{ key: string; mime: string; etag?: string; inline?: boolean } | undefined>, label = "file") {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    /** Скрываем отсутствующий или запрещённый файл одинаковым ответом 404. */
    const unavailable = () => res.status(404).json({ error: "Файл недоступен." });
    const abort = new AbortController();
    /** Прерываем чтение хранилища при закрытии незавершённого ответа, чтобы не продолжать передачу без клиента. */
    const cancel = () => {
      if (!res.writableFinished) abort.abort();
    };
    res.once("close", cancel);
    let reader: ReturnType<typeof privateObjectReader> | undefined;
    let body: Readable | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    /** Продлеваем только таймер отсутствия данных: длительная, но движущаяся загрузка не обрывается по общей длительности. */
    const progress = () => {
      clearTimeout(idle);
      idle = setTimeout(() => abort.abort(), 30_000);
      idle.unref();
    };
    try {
      const file = await resolve();
      if (!file) return unavailable();
      if (res.destroyed) return;
      reader = privateObjectReader(file.key, abort.signal);
      const meta = await reader.head();
      const size = meta.ContentLength;
      if (
        typeof size !== "number" ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !meta.ETag || (file.etag !== undefined && file.etag !== meta.ETag)
      )
        throw new Error("Invalid object metadata");
      res.setHeader("Content-Type", file.mime);
      const extension = DOWNLOAD_EXTENSIONS.get(
        file.mime.split(";")[0].trim().toLowerCase(),
      ) ?? "bin";
      res.setHeader(
        "Content-Disposition",
        `${file.inline ? "inline" : "attachment"}; filename="${label}.${extension}"`,
      );
      res.setHeader("Content-Length", size);
      res.setHeader("Accept-Ranges", "bytes");
      if (req.method === "HEAD") return res.status(200).end();
      const range =
        req.headers.range !== undefined
          ? byteRange(req.headers.range, size)
          : null;
      if (range === undefined) {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Type");
        res.removeHeader("Content-Disposition");
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.status(416).json({ error: "Диапазон недоступен." });
      }
      const rangeHeader = range
        ? `bytes=${range.start}-${range.end}`
        : undefined;
// Условный GET должен вернуть тот же ETag, точный диапазон и длину: иначе байты изменившегося объекта не выдаются.
      const object = await reader.get(meta.ETag, rangeHeader);
      if (object.Body instanceof Readable) body = object.Body;
      const length = range ? range.end - range.start + 1 : size;
      const expectedRange = range
        ? `bytes ${range.start}-${range.end}/${size}`
        : undefined;
      if (
        !body ||
        object.ContentLength !== length ||
        object.ContentRange !== expectedRange ||
        object.ETag !== meta.ETag
      )
        throw new Error("Invalid object response");
      res.setHeader("Content-Length", length!);
      if (range) {
        res.status(206);
        res.setHeader("Content-Range", expectedRange!);
      }
      // Bound stalled data flow, not the total duration of a progressing download.
      body.on("data", progress);
      progress();
      await pipeline(body, res, { signal: abort.signal });
    } catch {
      if (res.headersSent || res.destroyed) {
        res.destroy();
        return;
      }
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Type");
      res.removeHeader("Content-Disposition");
      res.status(503).json({ error: "Файл временно недоступен." });
// Очистка срабатывает при успехе, отказе, разрыве клиента и ошибке: снимаем обработчики, таймер и закрываем S3-ресурсы.
    } finally {
      res.off("close", cancel);
      clearTimeout(idle);
      body?.off("data", progress);
      abort.abort();
      body?.destroy();
      reader?.close();
    }
}
