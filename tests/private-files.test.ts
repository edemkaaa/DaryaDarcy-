import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { privateObjectReader } from "../apps/backend/src/media/private-object";

// Native AWS SDK and owned HTTP wire, not SQL/auth/ACL acceptance.
let wire: Server,
  requests = 0,
  closed = false;
beforeAll(async () => {
  wire = createServer((req) => {
    requests++;
    // Intentionally withhold headers; the client must bound the wait itself.
    req.socket.once("close", () => {
      closed = true;
    });
  });
  await new Promise<void>((done) => wire.listen(0, "127.0.0.1", done));
  vi.stubEnv(
    "S3_ENDPOINT",
    `http://127.0.0.1:${(wire.address() as AddressInfo).port}`,
  );
  vi.stubEnv("S3_BUCKET", "timeout-fixture");
  vi.stubEnv("S3_ACCESS_KEY", "timeout-fixture-access");
  vi.stubEnv("S3_SECRET_KEY", "timeout-fixture-secret");
});
afterAll(async () => {
  wire?.closeAllConnections();
  if (wire) await new Promise<void>((done) => wire.close(() => done()));
  vi.unstubAllEnvs();
});
it("times out withheld provider headers before the outer safety cutoff, with no retries", async () => {
  const reader = privateObjectReader(
    "feed/documents/fixture.txt",
    AbortSignal.timeout(12_000),
  );
  try {
    await expect(reader.head()).rejects.toMatchObject({ name: "TimeoutError" });
    expect(requests).toBe(1);
    await vi.waitFor(() => expect(closed).toBe(true));
  } finally {
    reader.close();
  }
}, 15_000);
