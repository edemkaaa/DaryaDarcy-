import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { proxy } from "../apps/frontend/src/proxy";

let directory: string;
const manifest = {
  version: 1,
  endpoint: "https://s3.twcstorage.ru",
  bucket: "daryadarcy-s3",
  denyKeys: ["feed/club/секрет.jpg", "feed/club/video.jpg"],
  preservedKeys: ["feed/club/public-cover.jpg"],
};
function configure(value: unknown = manifest) {
  const path = join(directory, "manifest.json");
  const bytes = JSON.stringify(value);
  writeFileSync(path, bytes, { mode: 0o600 });
  vi.stubEnv("LEGACY_CLUB_IMAGE_MANIFEST_PATH", path);
  vi.stubEnv(
    "LEGACY_CLUB_IMAGE_MANIFEST_SHA256",
    createHash("sha256").update(bytes).digest("hex"),
  );
}
function optimized(source: string, cookie = "") {
  const url = new URL("https://app.test/_next/image");
  url.searchParams.set("url", source);
  url.searchParams.set("w", "640");
  url.searchParams.set("q", "75");
  return new NextRequest(url, { headers: { cookie } });
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "club-guard-"));
  vi.stubEnv("LEGACY_CLUB_IMAGE_GUARD_ENABLED", "true");
  configure();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

it.each([undefined, "false", "1"])(
  "stays disabled without an explicit true flag (%s)",
  (flag) => {
    vi.stubEnv("LEGACY_CLUB_IMAGE_GUARD_ENABLED", flag);
    vi.stubEnv("LEGACY_CLUB_IMAGE_MANIFEST_PATH", "/missing/private-manifest");
    expect(
      proxy(
        optimized("https://s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg"),
      ).status,
    ).toBe(200);
  },
);
it.each([
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/секрет.jpg",
  "https://s3.twcstorage.ru:443/daryadarcy-s3/feed/club/%D1%81%D0%B5%D0%BA%D1%80%D0%B5%D1%82.jpg?download=1",
  "https://S3.TWCSTORAGE.RU/daryadarcy-s3/feed/club/video.jpg?anything=1#fragment",
  encodeURIComponent(
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
  ),
  encodeURIComponent(
    encodeURIComponent(
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
    ),
  ),
])("denies an exact old key before the cache for every role: %s", (url) => {
  for (const cookie of ["", "session=member", "session=admin"]) {
    const response = proxy(optimized(url, cookie));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-middleware-next")).toBeNull();
  }
});
it.each([
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/public-cover.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/unrelated.jpg",
  "https://s3.twcstorage.ru/different-bucket/feed/club/video.jpg",
  "https://another.test/daryadarcy-s3/feed/club/video.jpg",
  "/assets/responsive/free-loshadka.webp",
])("preserves public and unrelated sources: %s", (url) => {
  expect(proxy(optimized(url)).status).toBe(200);
});
it.each([
  "https:////s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
  "https:/s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
  "https:s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/%2576ideo.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/club/%ZZ.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/x/../club/video.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/%2e%2e/club/video.jpg",
  "https://user:pass@s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg",
  "not a url",
])("rejects malformed or ambiguous sources: %s", (url) => {
  expect(proxy(optimized(url)).status).toBe(400);
});
it("rejects duplicate source parameters", () => {
  const request = optimized(
    manifest.endpoint + "/daryadarcy-s3/feed/club/video.jpg",
  );
  request.nextUrl.searchParams.append("url", "/assets/responsive/free.webp");
  expect(proxy(request).status).toBe(400);
});
it.each([
  { ...manifest, version: 2 },
  { ...manifest, denyKeys: [...manifest.denyKeys, manifest.preservedKeys[0]] },
  { ...manifest, denyKeys: ["feed/../private.jpg"] },
  { ...manifest, denyKeys: [] },
])(
  "fails closed for invalid configuration without leaking its contents",
  async (value) => {
    configure(value);
    const response = proxy(
      optimized("https://s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Материал недоступен.");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  },
);
it("requires the operator's exact manifest digest", () => {
  vi.stubEnv("LEGACY_CLUB_IMAGE_MANIFEST_SHA256", "0".repeat(64));
  expect(
    proxy(
      optimized("https://s3.twcstorage.ru/daryadarcy-s3/feed/club/video.jpg"),
    ).status,
  ).toBe(503);
  expect(proxy(new NextRequest("https://app.test/club")).status).toBe(200);
});
