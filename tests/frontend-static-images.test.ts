/// <reference types="next/image-types/global" />
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/ui/static-image-catalog", () => ({
  STATIC_IMAGE_URLS: {
    "/assets/photo.jpg": "/_next/static/media/photo.hash.jpg",
  },
  STATIC_IMAGE_VARIANTS: {
    "/assets/photo.jpg": [
      { uri: "/assets/responsive/photo.w320.hash.webp", width: 320 },
      { uri: "/assets/responsive/photo.w640.hash.webp", width: 640 },
      { uri: "/assets/responsive/photo.w960.hash.webp", width: 960 },
    ],
  },
}));

import {
  resolveImageAttributes,
  resolveImageUri,
} from "@/shared/ui/static-images";

describe("static image previews", () => {
  it("serves public feed photographs as resized previews, retaining original viewer URLs", () => {
    const uri = "https://s3.twcstorage.ru/daryadarcy-s3/feed/post/photo_1.jpg";
    const preview = resolveImageAttributes(uri);
    expect(preview.src).toMatch(/^\/_next\/image\?/);
    expect(
      new URL(preview.src!, "https://app.test").searchParams.get("url"),
    ).toBe(uri);
    expect(preview.srcSet).toContain("w=640");
    expect(resolveImageAttributes(uri, true).src).toBe(uri);
  });

  it.each([
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/a.jpg?signature=secret",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/a.jpg#secret",
    "https://user:pass@s3.twcstorage.ru/daryadarcy-s3/feed/a.jpg",
    "https://s3.twcstorage.ru/other-bucket/feed/a.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/club/a.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/uploads/a.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/a.svg",
    "https://s3.twcstorage.ru.evil.test/daryadarcy-s3/feed/a.jpg",
  ])("never proxies signed, private or foreign media: %s", (uri) => {
    expect(resolveImageAttributes(uri)).toEqual({
      src: uri,
      srcSet: undefined,
      sizes: undefined,
    });
  });

  it("can recompress a bundled preview without changing its full-size source", () => {
    const uri = "/assets/responsive/club.w320.hash.webp";
    expect(resolveImageAttributes(uri, false, true).src).toMatch(
      /^\/_next\/image\?/,
    );
    expect(resolveImageAttributes(uri, true, true).src).toBe(uri);
  });

  it("offers smaller variants while keeping the original available for a viewer", () => {
    expect(resolveImageAttributes("/assets/photo.jpg")).toEqual({
      src: "/assets/responsive/photo.w640.hash.webp",
      srcSet:
        "/assets/responsive/photo.w320.hash.webp 320w, /assets/responsive/photo.w640.hash.webp 640w, /assets/responsive/photo.w960.hash.webp 960w",
      sizes: "(max-width: 480px) 100vw, 480px",
    });
    expect(resolveImageAttributes("/assets/photo.jpg", true)).toEqual({
      src: "/_next/static/media/photo.hash.jpg",
      srcSet: undefined,
      sizes: undefined,
    });
  });

  it("lets a small card select an existing small variant without shrinking its viewer", () => {
    const thumbnail = resolveImageAttributes(
      "/assets/photo.jpg",
      false,
      false,
      "120px",
    );
    expect(thumbnail.sizes).toBe("120px");
    expect(thumbnail.srcSet).toContain("320w");
    expect(resolveImageAttributes("/assets/photo.jpg", true).src).toBe(
      "/_next/static/media/photo.hash.jpg",
    );
    expect(
      resolveImageAttributes(
        "/api/media/library-files/private/photo",
        false,
        false,
        "120px",
      ).srcSet,
    ).toBeUndefined();
  });

  it("preserves signed media URLs, data, blobs and unknown local paths exactly", () => {
    for (const uri of [
      "https://s3.twcstorage.ru/daryadarcy-s3/uploads/photo.webp?X-Amz-Signature=abc&x=1%2F2",
      "data:image/png;base64,abc",
      "blob:https://example.test/123",
      "/media/private/photo.jpg",
    ]) {
      expect(resolveImageAttributes(uri)).toEqual({
        src: uri,
        srcSet: undefined,
        sizes: undefined,
      });
      expect(resolveImageAttributes(uri, true).src).toBe(uri);
    }
  });

  it("does not mistake inherited object properties for assets", () => {
    for (const uri of ["toString", "__proto__", "constructor"]) {
      expect(resolveImageUri(uri)).toBe(uri);
      expect(resolveImageAttributes(uri).src).toBe(uri);
    }
  });

  it("does not manufacture a source when an image is absent", () => {
    expect(resolveImageAttributes(undefined)).toEqual({
      src: undefined,
      srcSet: undefined,
      sizes: undefined,
    });
  });
});
