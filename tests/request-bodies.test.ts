import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { ForbiddenError } from "../packages/shared/src/_core/errors";
const boundary = vi.hoisted(() => ({ auth: vi.fn(), storage: vi.fn() }));
vi.mock("../apps/backend/src/_core/sdk", () => ({ sdk: { authenticateRequest: boundary.auth } }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: boundary.storage }));
vi.mock("../apps/backend/src/db", () => ({ isOwnerAccount: (user: { role: string }) => user.role === "admin" }));
import { registerRequestBodies } from "../apps/backend/src/_core/request-bodies";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { VideoUploadController } from "../apps/backend/src/content/video-upload.controller";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { mp4Fixture } from "./helpers/media-fixtures";
let server: Server, base: string;
beforeAll(async () => {
  const app = express(); registerRequestBodies(app);
  const controller = new VideoUploadController(new ContentUploadService(), new SessionService());
  app.post("/api/admin/upload-video", (req, res) => { void controller.uploadVideo(req, res); });
  for (const path of ["/api/auth/login", "/api/write", "/api/trpc/admin.uploadMedia", "/api/trpc/profile.uploadAvatar", "/api/trpc/profile.uploadAvatar,auth.me"]) app.post(path, (req, res) => res.json({ parsed: Boolean(req.body) }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  boundary.auth.mockReset().mockImplementation(async req => {
    if (req.headers.authorization === "Bearer admin") return { id: 1, role: "admin", blockedAt: null };
    if (req.headers.authorization === "Bearer member") return { id: 2, role: "user", blockedAt: null };
    throw ForbiddenError("Invalid session");
  });
  boundary.storage.mockReset().mockResolvedValue({ url: "https://assets.example.test/video.mp4" });
});
function json(path: string, size: number, token?: string) {
  return fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ payload: "x".repeat(size) }) });
}
it("authenticates raw video before allocating its body", async () => {
  let firstBody: unknown = "not called";
  const authenticate = boundary.auth.getMockImplementation()!;
  boundary.auth.mockImplementation(async req => { if (boundary.auth.mock.calls.length === 1) firstBody = req.body; return authenticate(req); });
  const response = await fetch(base + "/api/admin/upload-video", { method: "POST", headers: { Authorization: "Bearer admin", "Content-Type": "video/mp4" }, body: new Uint8Array(mp4Fixture) });
  expect(response.status).toBe(200); expect(firstBody).toBeUndefined();
});
it("bounds public authentication JSON to 16 KiB", async () => { expect((await json("/api/auth/login", 17000)).status).toBe(413); });
it("bounds ordinary JSON to 256 KiB", async () => { expect((await json("/api/write", 270000)).status).toBe(413); });
it("refuses anonymous upload JSON before its handler", async () => { expect((await json("/api/trpc/profile.uploadAvatar", 300000)).status).toBe(401); });
it("requires an administrator for large media JSON", async () => { expect((await json("/api/trpc/admin.uploadMedia", 300000, "member")).status).toBe(403); });
it("preserves authenticated photo and admin media requests larger than the ordinary limit", async () => {
  expect((await json("/api/trpc/profile.uploadAvatar", 300000, "member")).status).toBe(200);
  expect((await json("/api/trpc/admin.uploadMedia", 300000, "admin")).status).toBe(200);
});
it("guards upload procedures even inside a batch", async () => { expect((await json("/api/trpc/profile.uploadAvatar,auth.me", 300000)).status).toBe(401); });
it("returns a generic JSON parse error without echoing request content", async () => {
  const response = await fetch(base + "/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{SECRET_INVALID_BODY}" });
  expect(response.status).toBe(400); expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.text()).not.toContain("SECRET_INVALID_BODY");
});
it("refuses raw uploads from non-administrators", async () => {
  const response = await fetch(base + "/api/admin/upload-video", { method: "POST", headers: { Authorization: "Bearer member", "Content-Type": "video/mp4" }, body: "small fixture" });
  expect(response.status).toBe(403); expect(boundary.storage).not.toHaveBeenCalled();
});
it("keeps storage exception details out of raw upload responses and logs", async () => {
  boundary.storage.mockRejectedValue(new Error("SECRET_STORAGE_ERROR"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await fetch(base + "/api/admin/upload-video", { method: "POST", headers: { Authorization: "Bearer admin", "Content-Type": "video/mp4" }, body: new Uint8Array(mp4Fixture) });
    expect(response.status).toBe(500); expect(await response.text()).not.toContain("SECRET_STORAGE_ERROR");
    expect(log.mock.calls.flat().join(" ")).not.toContain("SECRET_STORAGE_ERROR");
  } finally { log.mockRestore(); }
});
