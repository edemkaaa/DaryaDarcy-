/** Регрессия окончательно отключённого legacy upload: любые подготовленные detector/storage ошибки не достигаются. */
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
import { VideoUploadController } from "../apps/backend/src/content/video-upload.controller";

// Fault injection complements native real-worker tests; do not mock the policy or handler.
let server: Server, base: string;
/** Поднимаем собственный Express HTTP с настоящим parser/retired controller, без приложения и рабочих ресурсов. */
beforeAll(async () => {
  const app = express();
  registerRequestBodies(app);
  const controller = new VideoUploadController();
  app.post("/api/admin/upload-video", (_req, res) => {
    controller.uploadVideo(res);
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
/** Закрываем только локальный сервер. */
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
/** Сбрасываем detector/storage spies; их ответы не должны понадобиться после закрытия legacy-маршрута. */
beforeEach(() => {
  boundary.detect
    .mockReset()
    .mockResolvedValue({ ext: "mp4", mime: "video/mp4" });
  boundary.store
    .mockReset()
    .mockResolvedValue({ url: "https://assets.example.test/raw-video" });
});
/** Историческая fault-матрица теперь во всех случаях получает 404 с инструкцией защищённой загрузки; ни detector, ни storage не вызываются. */
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
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error:
          "Публичная загрузка отключена. Используйте защищённую загрузку файлов.",
      });
      if (source === "detect") expect(boundary.store).not.toHaveBeenCalled();
      expect(boundary.detect).not.toHaveBeenCalled();
      expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE_");
    } finally {
      log.mockRestore();
    }
  },
);
