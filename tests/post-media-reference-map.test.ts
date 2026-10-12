import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { collectPostReferences as collect } from "../tooling/lib/media-reference-map";

const url = "https://storage.example.test/club/comments/shared.webp";
const post = (id: number, extra = {}) => ({
  id,
  published: 1,
  status: "published",
  target: "feed",
  photos: [url],
  ...extra,
});
it("groups feed/both photos with club/draft attachments without using URL prefixes", () => {
  const report = collect({
    posts: [
      post(1),
      post(2, { target: "both" }),
      post(3, { target: "club" }),
      post(4, { status: "draft" }),
    ],
    media: [{ id: 5, postId: 4, url }],
  });
  expect(report.groups).toEqual([
    {
      urlHash: createHash("sha256").update(url).digest("hex"),
      visibility: "shared",
      references: [
        "posts:1.photos:0",
        "posts:2.photos:0",
        "posts:3.photos:0",
        "posts:4.photos:0",
        "post_media:5.url",
      ],
    },
  ]);
});
it("does not approve unmatched attachments or malformed photos as a complete map", () => {
  const report = collect({
    posts: [post(1, { photos: "not-json" })],
    media: [{ id: 7, postId: 99, url }],
  });
  expect(report.groups).toEqual([]);
  expect(report.issues).toEqual([
    "posts:1.photos.invalid-json",
    "post_media:7.parent-not-in-snapshot",
  ]);
});
it("keeps scheduled and unpublished references restricted", () => {
  const report = collect({
    posts: [post(1, { status: "scheduled" }), post(2, { published: 0 })],
    media: [],
  });
  expect(report.groups[0].visibility).toBe("restricted");
});
it("rejects ambiguous target metadata without echoing input", () => {
  expect(() =>
    collect({ posts: [post(1, { target: "PRIVATE_FIXTURE" })], media: [] }),
  ).toThrow("Invalid post snapshot");
});
