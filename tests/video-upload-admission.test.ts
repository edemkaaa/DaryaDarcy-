import express from "express";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mp4Fixture } from "./helpers/media-fixtures";

const storage = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("../apps/backend/src/_core/sdk", () => ({ sdk: {
  authenticateRequest: async () => ({ id: 1, role: "admin", sessionVersion: 0 }),
} }));
vi.mock("../apps/backend/src/content/private-attachment-uploads", () => ({ storePrivateAttachment: storage.write }));
import { registerRequestBodies } from "../apps/backend/src/_core/request-bodies";
import { PrivateVideoUploadController } from "../apps/backend/src/content/private-video-upload.controller";
import { SessionService } from "../apps/backend/src/identity/session.service";

let server: Server, base: string;
const path = "/api/admin/private-video-uploads?filename=clip.mp4";
const headers = { "content-type": "video/mp4", "idempotency-key": "video-admission-intent-0001" };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
beforeAll(async () => {
  vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
  vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "true");
  const app = express(); registerRequestBodies(app);
  const controller = new PrivateVideoUploadController(new SessionService());
  app.post("/api/admin/private-video-uploads", (req, res) => { void controller.upload(req, res); });
  app.get("/health", (_req, res) => { res.json({ ok: true }); });
  server = createServer(app);
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); vi.unstubAllEnvs(); });

it("refuses another video before reading its body while storage is busy, without blocking ordinary reads", async () => {
  const entered = deferred(), release = deferred();
  storage.write.mockImplementation(async () => { entered.resolve(); await release.promise; return { state: "ready" }; });
  const first = fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture) });
  await entered.promise;
  try {
    // Send headers only. A parser waiting for the declared body cannot answer.
    const second = await new Promise<{ status: number; retry: string | undefined; cache: string | undefined }>((resolve, reject) => {
      const req = request(base + path, { method: "POST", headers: { ...headers, "content-length": 80 * 1024 * 1024 } }, res => {
        res.resume(); resolve({ status: res.statusCode!, retry: res.headers["retry-after"], cache: res.headers["cache-control"] }); req.destroy();
      });
      req.on("error", reject); req.setTimeout(500, () => { req.destroy(new Error("upload body was read before admission")); }); req.flushHeaders();
    });
    expect(second.status).toBe(429); expect(second.retry).toBeTruthy(); expect(second.cache).toBe("no-store");
    expect((await fetch(base + "/health")).status).toBe(200);
  } finally { release.resolve(); await first; }
  storage.write.mockResolvedValue({ state: "ready" });
  expect((await fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture) })).status).toBe(200);
});

it("keeps admission occupied after the client disconnects until its in-flight upload settles", async () => {
  const entered = deferred(), release = deferred();
  storage.write.mockImplementation(async () => { entered.resolve(); await release.promise; return { state: "ready" }; });
  const client = request(base + path, { method: "POST", headers }); client.on("error", () => {}); client.end(mp4Fixture);
  await entered.promise; client.destroy();
  try {
    const response = await fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture), signal: AbortSignal.timeout(1000) });
    expect(response.status).toBe(429);
  } finally { release.resolve(); }
  await vi.waitFor(async () => {
    storage.write.mockResolvedValue({ state: "ready" });
    expect((await fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture) })).status).toBe(200);
  });
});

it("releases admission after an aborted body, parser rejection and controller rejection", async () => {
  const aborted = request(base + path, { method: "POST", headers: { ...headers, "content-length": 1000 } });
  aborted.on("error", () => {});
  await new Promise<void>(resolve => {
    server.once("request", () => { setImmediate(resolve); });
    aborted.write("partial");
  });
  try {
    expect((await fetch(base + path, { method: "POST", headers, body: "probe" })).status).toBe(429);
  } finally { aborted.destroy(); }
  await vi.waitFor(async () => {
    expect((await fetch(base + path, { method: "POST", headers: { ...headers, "content-encoding": "gzip" }, body: "bad" })).status).toBe(415);
  });
  expect((await fetch(base + path, { method: "POST", headers, body: "not a video" })).status).toBe(400);
  storage.write.mockRejectedValueOnce(new Error("synthetic storage failure"));
  expect((await fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture) })).status).toBe(503);
  storage.write.mockResolvedValue({ state: "ready" });
  expect((await fetch(base + path, { method: "POST", headers, body: new Uint8Array(mp4Fixture) })).status).toBe(200);
});
