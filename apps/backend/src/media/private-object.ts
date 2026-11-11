/** Проверяем принадлежность ключа вложению перед чтением закрытого объекта. */
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { ENV } from "../_core/env";

/** Exact own-object resolution, never fetches a submitted/persisted URL. */
/** Разрешаем лишь точную каноническую ссылку разрешённого каталога настроенного бакета без нормализованных алиасов, параметров и traversal; введённый URL не скачивается. */
export function ownAttachmentKey(raw: string): string | undefined {
  try {
    const endpoint = new URL(ENV.s3Endpoint);
    const url = new URL(raw);
    // URL parsing removes dot segments and normalizes aliases; do not guess identity.
    if (url.href !== raw) return;
    const loopback =
      !ENV.isProduction &&
      endpoint.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
    if (
      (!loopback && endpoint.protocol !== "https:") ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      url.origin !== endpoint.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !ENV.s3Bucket
    )
      return;
    const prefix = `${endpoint.pathname.replace(/\/+$/, "")}/${encodeURIComponent(ENV.s3Bucket)}/`;
    if (!url.pathname.startsWith(prefix)) return;
    const encoded = url.pathname.slice(prefix.length);
    const parts = encoded.split("/").map(decodeURIComponent);
    if (
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[\\/\x00-\x1f\x7f]/.test(part),
      )
    )
      return;
    /** Повторно кодируем сегмент в строгую каноническую форму, чтобы отличить иной URL от того же текстового ключа. */
    const encode = (part: string) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    if (parts.map(encode).join("/") !== encoded) return;
    const key = parts.join("/");
    if (!/^feed\/(audio|documents|videos|reels)\/.+/.test(key)) return;
    return key;
  } catch {
    return;
  }
}

/** Only the configured endpoint receives credentials; no fallback or redirects. */
/** Создаём ограниченный S3-клиент только настроенного endpoint и возвращаем HEAD/условный GET/закрытие с общим сигналом отмены, без повторов и fallback. */
export function privateObjectReader(key: string, signal: AbortSignal) {
  if (!ENV.s3Endpoint || !ENV.s3Bucket || !ENV.s3AccessKey || !ENV.s3SecretKey)
    throw new Error("Storage unavailable");
  const client = new S3Client({
    endpoint: ENV.s3Endpoint,
    region: "ru-1",
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    forcePathStyle: true,
    maxAttempts: 1,
    // Fail on stalled connection/response headers; do not merely log a warning.
    requestHandler: {
      connectionTimeout: 5_000,
      requestTimeout: 10_000,
      throwOnRequestTimeout: true,
    },
  });
  const object = { Bucket: ENV.s3Bucket, Key: key };
  return {
    /** Читаем метаданные точного объекта с отменой запроса до передачи байтов. */
    head: () =>
      client.send(new HeadObjectCommand(object), { abortSignal: signal }),
    /** Запрашиваем только объект с подтверждённым ETag и необязательным проверенным диапазоном. */
    get: (etag: string, range?: string) =>
      client.send(
        new GetObjectCommand({ ...object, IfMatch: etag, Range: range }),
        { abortSignal: signal },
      ),
    /** Освобождаем соединения S3-клиента после завершения потоковой выдачи. */
    close: () => client.destroy(),
  };
}
