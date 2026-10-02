import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importVideoFromUrl, isOurStorageUrl } from "../apps/backend/src/admin-video";

const requests = vi.fn(async () => new Response(Buffer.alloc(128), { headers: { "content-type": "video/mp4" } }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: async () => ({ url: "https://assets.example.test/copied.mp4" }) }));
beforeEach(() => {
  vi.stubEnv("S3_ENDPOINT", "https://s3.example.test"); vi.stubEnv("S3_BUCKET", "darcy");
  requests.mockClear(); vi.stubGlobal("fetch", requests);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("video link import never makes a server-side request to a user-selected URL", () => {
  it.each([
    "http://127.0.0.1/admin.mp4", "http://169.254.169.254/latest/meta-data/video.mp4",
    "https://s3.example.test.evil.test/darcy/a.mp4", "https://evil.test/darcy/a.mp4",
    "https://evil.test/s3.twcstorage.ru/daryadarcy.mp4", "https://s3.example.test@evil.test/darcy/a.mp4",
  ])("rejects untrusted URL %s before network access", async (url) => {
    await expect(importVideoFromUrl(url)).rejects.toThrow();
    expect(requests).not.toHaveBeenCalled();
    expect(isOurStorageUrl(url)).toBe(false);
  });
  it("retains a configured-storage URL without downloading it", async () => {
    expect(await importVideoFromUrl("https://s3.example.test/darcy/feed/a.mp4")).toEqual({ url: "https://s3.example.test/darcy/feed/a.mp4" });
    expect(requests).not.toHaveBeenCalled();
  });
  it("rejects encoded traversal out of the configured bucket", async () => {
    expect(isOurStorageUrl("https://s3.example.test/darcy/%2e%2e/other/a.mp4")).toBe(false);
    await expect(importVideoFromUrl("https://s3.example.test/darcy/%2e%2e/other/a.mp4")).rejects.toThrow();
    expect(requests).not.toHaveBeenCalled();
  });
});
