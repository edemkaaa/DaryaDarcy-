import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { mp4Fixture } from "./helpers/media-fixtures";

const boundary = vi.hoisted(() => ({ detect: vi.fn(), store: vi.fn() }));
vi.mock("../apps/backend/src/_core/sdk", () => ({
  sdk: { authenticateRequest: async () => ({ id: 1, role: "admin" }) },
}));
vi.mock("../apps/backend/src/media/file-signature", () => ({
  detectBinaryFileType: boundary.detect,
}));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: boundary.store }));
import { registerRequestBodies } from "../apps/backend/src/_core/request-bodies";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { VideoUploadController } from "../apps/backend/src/content/video-upload.controller";
import { SessionService } from "../apps/backend/src/identity/session.service";

// Fault injection complements native real-worker tests; do not mock the policy or handler.
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  registerRequestBodies(app);
  const controller = new VideoUploadController(
    new ContentUploadService(),
    new SessionService(),
  );
  app.post("/api/admin/upload-video", (req, res) => {
    void controller.uploadVideo(req, res);
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  boundary.detect
    .mockReset()
    .mockResolvedValue({ ext: "mp4", mime: "video/mp4" });
  boundary.store
    .mockReset()
    .mockResolvedValue({ url: "https://assets.example.test/raw-video" });
});
it.each([
  [
    "detector input deadline",
    "detect",
    new TRPCError({ code: "BAD_REQUEST", message: "PRIVATE_DETECTOR" }),
    400,
  ],
  [
    "detector infrastructure",
    "detect",
    new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "PRIVATE_DETECTOR",
    }),
    500,
  ],
  ["worker construction", "detect", new Error("PRIVATE_DETECTOR"), 500],
  [
    "provider uses an input-like exception",
    "store",
    new TRPCError({ code: "BAD_REQUEST", message: "PRIVATE_PROVIDER" }),
    500,
  ],
] as const)(
  "maps %s without leaking internals",
  async (_name, source, error, status) => {
    boundary[source].mockRejectedValueOnce(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await fetch(base + "/api/admin/upload-video", {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: new Uint8Array(mp4Fixture),
      });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error:
          status === 400
            ? "Некорректный видеофайл"
            : "Не удалось загрузить видео",
      });
      if (source === "detect") expect(boundary.store).not.toHaveBeenCalled();
      expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE_");
    } finally {
      log.mockRestore();
    }
  },
);
