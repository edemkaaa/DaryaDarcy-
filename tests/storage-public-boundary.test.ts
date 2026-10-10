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
describe("current storage publication boundary on loopback S3 wire", () => {
  let server: Server, endpoint: string;
  const requests: { method: string; path: string; acl: string | undefined }[] =
    [];
  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push({
        method: request.method!,
        path: new URL(request.url!, "http://loopback.invalid").pathname,
        acl: request.headers["x-amz-acl"] as string | undefined,
      });
      request.resume();
      request.on("end", () => {
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
  beforeEach(() => {
    requests.length = 0;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
  });
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
  it("returns an unsigned object address without an application access check or storage request", async () => {
    const stored = await storageGet("/feed/documents/synthetic");
    expect(stored).toEqual({
      key: "feed/documents/synthetic",
      url: endpoint + "/synthetic-media/feed/documents/synthetic",
    });
    expect(requests).toEqual([]);
  });
});
