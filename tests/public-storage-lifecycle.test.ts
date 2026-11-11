/** SDK S3/Forge обращаются только к owned loopback-серверу, который принимает body и удерживает ACK. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { storagePut } from "../apps/backend/src/storage";

/** Проверяем timeout/abort после передачи байтов: успешное чтение body ещё не подтверждает сохранение. */
describe("public storage lifecycle on owned loopback transports", () => {
  let server: Server;
  let requests: number;
  let closed: boolean;
  let received: Promise<void>;
  /** Создаём новый локальный transport и synthetic credentials; ни один рабочий bucket не используется. */
  beforeEach(async () => {
    requests = 0;
    closed = false;
    let accept!: () => void;
    received = new Promise<void>((resolve) => {
      accept = resolve;
    });
    server = createServer((request, response) => {
      requests++;
      request.resume();
      response.on("close", () => {
        closed = true;
      });
      request.on("end", accept);
      // Consume the whole PUT, but never acknowledge it: outcome is unknown.
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vi.stubEnv("S3_ENDPOINT", endpoint);
    vi.stubEnv("S3_BUCKET", "synthetic-media");
    vi.stubEnv("S3_ACCESS_KEY", "synthetic-access");
    vi.stubEnv("S3_SECRET_KEY", "synthetic-secret");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", endpoint);
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "synthetic-forge");
  });
  /** Разрываем оставшиеся сокеты, закрываем сервер и снимаем env. */
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  });
  /** Неизвестный исход PUT должен завершиться отказом и закрытым сокетом без автоматического повторного write. */
  it("bounds a stalled public PUT below the client deadline without an automatic second write", async () => {
    const outcome = storagePut("covers/stalled.webp", "bytes").then(
      () => "success",
      () => "rejected",
    );
    await received;
    expect(
      await Promise.race([
        outcome,
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("still pending"), 12000),
        ),
      ]),
    ).toBe("rejected");
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(requests).toBe(1);
  }, 16000);
  /** Abort владельца прерывает уже идущую S3/Forge отправку быстрее внешнего защитного timeout. */
  it.each(["s3", "forge"])(
    "cancels an in-flight %s upload when its request owner aborts",
    async (backend) => {
      if (backend === "forge") vi.stubEnv("S3_ACCESS_KEY", "");
      const controller = new AbortController();
      const outcome = storagePut(
        "covers/cancelled.webp",
        "bytes",
        "image/webp",
        { signal: controller.signal },
      ).then(
        () => "success",
        () => "rejected",
      );
      await received;
      controller.abort();
      expect(
        await Promise.race([
          outcome,
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("still pending"), 800),
          ),
        ]),
      ).toBe("rejected");
      await vi.waitFor(() => expect(closed).toBe(true));
      expect(requests).toBe(1);
    },
  );
});
