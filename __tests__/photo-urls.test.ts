import { describe, expect, it } from "vitest";
import { sanitizePhotoUrls } from "../apps/frontend/src/shared/media/photo-urls";

describe("API photo URLs", () => {
  it("keeps valid signed URLs unchanged and in order", () => {
    const urls = [
      "https://cdn.example/a.jpg?signature=abc%2Fdef",
      "http://cdn.example/b.png",
    ];
    expect(sanitizePhotoUrls(urls)).toEqual(urls);
  });
  it("rejects invalid types, local and executable URLs", () => {
    expect(
      sanitizePhotoUrls([
        null,
        {},
        4,
        "",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://u:p@cdn.example/a",
        "not a URL",
      ]),
    ).toEqual([]);
    expect(sanitizePhotoUrls(null)).toEqual([]);
  });
  it("retains canonical uploaded photos alongside old signed CDN URLs", () => {
    const url = "/api/media/content-files/11111111-1111-4111-8111-111111111111";
    const old = "https://cdn.example/old.jpg?signature=abc%2Fdef";
    expect(sanitizePhotoUrls([old, url, old])).toEqual([old, url, old]);
    expect(
      sanitizePhotoUrls([
        "//cdn.example/photo.jpg",
        "/api/auth/logout",
        `${url}/../other`,
        `${url}?redirect=https://outside.example`,
        `${url}#fragment`,
        ` ${url}`,
        "/api/media/content-files/not-an-id",
        "/api/media/content-files/%2e%2e",
        "/\\outside.example/photo.jpg",
      ]),
    ).toEqual([]);
  });
});
