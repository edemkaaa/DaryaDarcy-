/** Характеризация публичного storage helper на loopback wire: это не сертификация private ACL или права на файлы. */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { storageGet, storagePut } from "../apps/backend/src/storage";

// Characterization of the current M1 boundary, not a private-storage acceptance.
// The real AWS SDK talks only to this owned loopback HTTP wire. No bucket/key
// policy is simulated or certified; no production data/credentials are used.
/** Сервер-fixture хранит exact-path bytes, но намеренно не имитирует bucket policy/ACL. */
describe("current storage publication boundary on loopback S3 wire", () => {
  let server: Server, endpoint: string;
  // Exact-path HTTP fixture only: deliberately does not implement bucket ACLs.
  const objects = new Map<string, Buffer>();
  const requests: { method: string; path: string; acl: string | undefined }[] =
    [];
  /** Собственный S3-like HTTP server принимает PUT/GET со synthetic credentials. */
  beforeAll(async () => {
    server = createServer((request, response) => {
      const path = new URL(request.url!, "http://loopback.invalid").pathname;
      if (request.method === "GET") {
        const bytes = objects.get(path);
        response.writeHead(bytes ? 200 : 404);
        response.end(bytes);
        return;
      }
      requests.push({
        method: request.method!,
        path,
        acl: request.headers["x-amz-acl"] as string | undefined,
      });
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        objects.set(path, Buffer.concat(chunks));
        response.writeHead(200, { ETag: '"synthetic-object"' });
        response.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vi.stubEnv("S3_ENDPOINT", endpoint);
    vi.stubEnv("S3_BUCKET", "synthetic-media");
    vi.stubEnv("S3_ACCESS_KEY", "synthetic-access-key");
    vi.stubEnv("S3_SECRET_KEY", "synthetic-secret-key");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
  });
  /** Очистка in-memory объектов и списка запросов не затрагивает настоящие файлы. */
  beforeEach(() => {
    requests.length = 0;
    objects.clear();
  });
  /** Закрываем sockets/server и снимаем env. */
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
  });
  /** Низкоуровневый legacy helper действительно запрашивает public-read; пригодность для закрытого контента этим не подтверждается. */
  it.each([
    "feed/photos/synthetic.webp",
    "feed/documents/synthetic",
    "club/comments/91402/synthetic.webp",
  ])(
    "requests public ACL and returns a direct object URL for %s",
    async (key) => {
      const stored = await storagePut(
        key,
        Buffer.from("SYNTHETIC_MEDIA"),
        "application/octet-stream",
      );
      expect(requests).toEqual([
        {
          method: "PUT",
          path: "/synthetic-media/" + key,
          acl: "public-read",
        },
      ]);
      expect(stored).toEqual({
        key,
        url: endpoint + "/synthetic-media/" + key,
      });
      expect(new URL(stored.url).search).toBe("");
    },
  );
  /** storageGet только строит прямой адрес и не авторизует скачивание. */
  it("returns an unsigned object address without an application access check or storage request", async () => {
    const stored = await storageGet("/feed/documents/synthetic");
    expect(stored).toEqual({
      key: "feed/documents/synthetic",
      url: endpoint + "/synthetic-media/feed/documents/synthetic",
    });
    expect(requests).toEqual([]);
  });
  /** Пробелы,#,?,literal%2F и Unicode кодируются как key, не query/fragment; GET проверяется только у owned fixture. */
  it.each([
    {
      key: "feed/documents/lesson #1?.pdf",
      path: "/synthetic-media/feed/documents/lesson%20%231%3F.pdf",
    },
    {
      key: "feed/documents/literal%2Fname.pdf",
      path: "/synthetic-media/feed/documents/literal%252Fname.pdf",
    },
    {
      key: "feed/documents/урок.pdf",
      path: "/synthetic-media/feed/documents/%D1%83%D1%80%D0%BE%D0%BA.pdf",
    },
  ])(
    "keeps the returned URL on the exact uploaded object: $key",
    async ({ key, path }) => {
      const stored = await storagePut(key, "SYNTHETIC_MEDIA");
      expect(requests).toEqual([{ method: "PUT", path, acl: "public-read" }]);
      expect(stored).toEqual({ key, url: endpoint + path });
      expect(await storageGet(key)).toEqual({ key, url: endpoint + path });
      expect(new URL(stored.url).search).toBe("");
      expect(new URL(stored.url).hash).toBe("");
      const response = await fetch(stored.url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("SYNTHETIC_MEDIA");
    },
  );
  /** Лишний slash endpoint не меняет фактический uploaded key. */
  it("keeps configured trailing endpoint separators out of the object key", async () => {
    vi.stubEnv("S3_ENDPOINT", endpoint + "/");
    try {
      const stored = await storagePut(
        "feed/documents/lesson.pdf",
        "SYNTHETIC_MEDIA",
      );
      expect(requests).toEqual([
        {
          method: "PUT",
          path: "/synthetic-media/feed/documents/lesson.pdf",
          acl: "public-read",
        },
      ]);
      expect(stored.url).toBe(
        endpoint + "/synthetic-media/feed/documents/lesson.pdf",
      );
      expect(await storageGet(stored.key)).toEqual(stored);
      const response = await fetch(stored.url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("SYNTHETIC_MEDIA");
    } finally {
      vi.stubEnv("S3_ENDPOINT", endpoint);
    }
  });
  /** Traversal, backslash, пустой key и control characters отвергаются до PUT/GET effect. */
  it.each([
    "feed/../private.pdf",
    "feed/./private.pdf",
    "feed\\private.pdf",
    "",
    "///",
    "feed/\nprivate.pdf",
  ])("rejects ambiguous object key before storage effects: %j", async (key) => {
    await expect(storageGet(key)).rejects.toThrow("Invalid storage key");
    await expect(storagePut(key, "SYNTHETIC_MEDIA")).rejects.toThrow(
      "Invalid storage key",
    );
    expect(requests).toEqual([]);
    expect(objects.size).toBe(0);
  });
});
