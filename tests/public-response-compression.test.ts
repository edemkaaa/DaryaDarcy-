import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";

const payload = {
  posts: [{ id: 1, text: "Публичный текст 🧪 ".repeat(200) }],
  nextCursor: null,
};
const bytes = Buffer.from(JSON.stringify(payload));
let server: Server, port: number;
beforeAll(async () => {
  const app = express();
  registerHttpSecurity(app);
  app.use((req, res) => {
    if (req.query.status) res.status(Number(req.query.status));
    if (req.query.noTransform) res.setHeader("Cache-Control", "no-transform");
    if (req.query.private) res.setHeader("Cache-Control", "private, no-store");
    if (req.query.cookie)
      res.setHeader("Set-Cookie", "fixture=opaque; HttpOnly");
    if (req.query.small) {
      res.json({ posts: [], nextCursor: null });
      return;
    }
    if (req.query.sse) {
      res.type("text/event-stream").end("data: " + bytes + "\n\n");
      return;
    }
    res.json(payload);
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function read(
  path: string,
  headers: Record<string, string | undefined> = {},
  method = "GET",
) {
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: Buffer;
  }>((resolve, reject) => {
    request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: { "Accept-Encoding": "gzip", ...headers },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () =>
          resolve({
            status: response.statusCode!,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
        response.on("error", reject);
      },
    )
      .on("error", reject)
      .end();
  });
}
describe("public JSON response compression", () => {
  it.each([
    "feed.listPaginated",
    "feed.getById",
    "feed.tags",
    "videos.catalog",
    "articles.list",
    "feed.listPaginated,feed.tags",
  ])("reduces %s while retaining the exact JSON bytes", async (procedure) => {
    const response = await read(`/api/trpc/${procedure}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers.vary).toContain("Accept-Encoding");
    expect(response.body.length).toBeLessThan(bytes.length / 2);
    expect(gunzipSync(response.body)).toEqual(bytes);
    expect(response.headers["cache-control"] ?? "").not.toContain("public");
  });
  it("negotiates Brotli without changing the JSON", async () => {
    const response = await read("/api/trpc/videos.catalog", {
      "Accept-Encoding": "br, gzip",
    });
    expect(response.headers["content-encoding"]).toBe("br");
    expect(brotliDecompressSync(response.body)).toEqual(bytes);
  });
  it.each([
    { Cookie: "app_session=fixture" },
    { Cookie: "" },
    { Authorization: "Bearer fixture" },
    { Range: "bytes=0-999" },
    { "If-Range": '"fixture"' },
  ])(
    "does not compress an authenticated or ranged read %j",
    async (headers) => {
      const response = await read("/api/trpc/feed.getById", headers);
      expect(response.headers["content-encoding"]).toBeUndefined();
      expect(response.body).toEqual(bytes);
    },
  );
  it.each([
    "/api/trpc/admin.postsPage",
    "/api/trpc/club.listByCategory",
    "/api/trpc/feed.listPaginated,auth.me",
    "/api/trpc/feed.listPaginated.evil",
    "/api/auth/password",
    "/api/media/content-files/file",
    "/media/file",
  ])("leaves unrelated or mixed reads unchanged: %s", async (path) => {
    const response = await read(path);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body).toEqual(bytes);
  });
  it.each([
    "?status=500",
    "?status=206",
    "?status=207",
    "?noTransform=1",
    "?sse=1",
    "?small=1",
    "?private=1",
    "?cookie=1",
  ])(
    "skips errors, partial/mixed responses and non-transformable data: %s",
    async (query) => {
      const response = await read("/api/trpc/feed.listPaginated" + query);
      expect(response.headers["content-encoding"]).toBeUndefined();
    },
  );
  it("retains identity for unsupported content negotiation", async () => {
    const response = await read("/api/trpc/feed.listPaginated", {
      "Accept-Encoding": "identity",
    });
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body).toEqual(bytes);
  });
  it("does not compress mutation responses", async () => {
    const response = await read("/api/trpc/feed.listPaginated", {}, "POST");
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
