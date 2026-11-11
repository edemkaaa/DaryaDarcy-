/** Content-Disposition/Range проверяются настоящим handler/AWS SDK на owned wire; authorized resolver synthetic, не SQL/auth приёмка. */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sendPrivateFile } from "../apps/backend/src/content/private-files.controller";

// Real HTTP handler and AWS SDK against an owned loopback wire. The resolver
// supplies authorized metadata; this is not SQL/auth/real-S3 acceptance.
const bytes = Buffer.from("0123456789");
const etag = '"fixture-v1"';
let wire: Server, api: Server, base: string;
let mime: string, label: string | undefined, inline: boolean;
let denied: boolean, stale: boolean, requests: string[];
let storageCalls = 0;

/** Случайный loopback порт выделяется отдельно API и S3-wire. */
async function listen(server: Server) {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Wire требует signed request и pinned If-Match; API передаёт синтетические разрешённые metadata в настоящий sendPrivateFile. */
beforeAll(async () => {
  wire = createServer((req, res) => {
    storageCalls++;
    if (
      new URL(req.url!, "http://loopback.invalid").pathname !==
        "/download-fixture/content/private-v1/fixture" ||
      !req.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ") ||
      (req.method !== "HEAD" && req.headers["if-match"] !== etag)
    ) {
      res.writeHead(403).end();
      return;
    }
    requests.push(req.method!);
    const partial = req.headers.range === "bytes=0-3";
    const body = partial ? bytes.subarray(0, 4) : bytes;
    res.statusCode = partial ? 206 : 200;
    res.setHeader("ETag", stale ? '"changed-object"' : etag);
    res.setHeader("Content-Length", body.length);
    if (partial) res.setHeader("Content-Range", "bytes 0-3/10");
    res.end(req.method === "HEAD" ? undefined : body);
  });
  vi.stubEnv("S3_ENDPOINT", await listen(wire));
  vi.stubEnv("S3_BUCKET", "download-fixture");
  vi.stubEnv("S3_ACCESS_KEY", "download-fixture-access");
  vi.stubEnv("S3_SECRET_KEY", "download-fixture-secret");
  const app = express();
  app.get("/file", (req, res) => {
    void sendPrivateFile(
      req,
      res,
      async () =>
        denied
          ? undefined
          : {
              key: "content/private-v1/fixture",
              mime,
              etag,
              inline,
            },
      label,
    );
  });
  api = createServer(app);
  base = await listen(api);
});

/** Сбрасываем MIME/label/inline/deny/stale и счётчики сетевых эффектов. */
beforeEach(() => {
  mime = "application/pdf";
  label = undefined;
  inline = denied = stale = false;
  requests = [];
  storageCalls = 0;
});

/** Закрываем оба owned servers и S3 env. */
afterAll(async () => {
  for (const server of [api, wire]) {
    server?.closeAllConnections();
    if (server) await new Promise<void>((done) => server.close(() => done()));
  }
  vi.unstubAllEnvs();
});

/** Формат имени выводится из MIME, bytes совпадают, ответ private/no-store/nosniff и HEAD предшествует GET. */
it.each([
  ["text/plain", "file.txt"],
  ["application/pdf", "file.pdf"],
  ["application/msword", "file.doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "file.docx",
  ],
  ["audio/mpeg", "file.mp3"],
  ["audio/mp4", "file.m4a"],
  ["audio/wav", "file.wav"],
  ["audio/x-wav", "file.wav"],
  ["audio/ogg", "file.ogg"],
  ["audio/webm", "file.webm"],
  ["video/mp4", "file.mp4"],
  ["video/webm", "file.webm"],
  ["video/quicktime", "file.mov"],
  ["application/octet-stream", "file.bin"],
  ["image/webp", "file.webp"],
  ["image/jpeg", "file.jpg"],
  ["image/png", "file.png"],
  [" Application/PDF ; charset=binary", "file.pdf"],
  ["application/x-unknown", "file.bin"],
])("downloads %s with a canonical extension", async (type, filename) => {
  mime = type;
  const response = await fetch(`${base}/file`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe(
    `attachment; filename="${filename}"`,
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(requests).toEqual(["HEAD", "GET"]);
});

/** 206 сохраняет имя attachment, правильный suffix и Content-Range. */
it("preserves the attachment identity and extension for a range response", async () => {
  label = "attachment-123";
  const response = await fetch(`${base}/file`, {
    headers: { Range: "bytes=0-3" },
  });
  expect(response.status).toBe(206);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="attachment-123.pdf"',
  );
  expect(response.headers.get("content-range")).toBe("bytes 0-3/10");
  expect(await response.text()).toBe("0123");
});

/** HEAD выдаёт metadata/filename без GET тела. */
it("uses the library key for HEAD without fetching object bytes", async () => {
  label = "holly";
  const response = await fetch(`${base}/file`, { method: "HEAD" });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="holly.pdf"',
  );
  expect(response.headers.get("content-length")).toBe("10");
  expect(await response.text()).toBe("");
  expect(requests).toEqual(["HEAD"]);
});

/** Inline-фото получает актуальные WebP MIME/extension. */
it("keeps normalized photos inline with the actual WebP format", async () => {
  mime = "image/webp";
  inline = true;
  const response = await fetch(`${base}/file`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe(
    'inline; filename="file.webp"',
  );
  expect(response.headers.get("content-type")).toBe("image/webp");
  await response.arrayBuffer();
});

/** Отказ resolver даёт404 до AWS и Content-Disposition. */
it("does not disclose a filename or call storage when authorization denies", async () => {
  denied = true;
  const response = await fetch(`${base}/file`);
  expect(response.status).toBe(404);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(storageCalls).toBe(0);
  expect(await response.json()).toEqual({ error: "Файл недоступен." });
});

/** Несовпавший ETag даёт503 уже после HEAD, без GET и download header. */
it("does not send a download header for changed object metadata", async () => {
  stale = true;
  const response = await fetch(`${base}/file`);
  expect(response.status).toBe(503);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(await response.json()).toEqual({ error: "Файл временно недоступен." });
  expect(requests).toEqual(["HEAD"]);
});

/** 416 содержит только корректную total range-информацию, не готовое скачивание. */
it("removes the download header for an unsatisfiable range", async () => {
  const response = await fetch(`${base}/file`, {
    headers: { Range: "bytes=10-" },
  });
  expect(response.status).toBe(416);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(response.headers.get("content-range")).toBe("bytes */10");
  await response.arrayBuffer();
  expect(requests).toEqual(["HEAD"]);
});
