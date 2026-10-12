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
  expect(report.groups).toEqual([
    {
      urlHash: createHash("sha256").update(url).digest("hex"),
      visibility: "unknown",
      references: ["post_media:7.url"],
    },
  ]);
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

it("groups an article cover with club rich-text links and comment photos across sources", () => {
  const report = collect({
    articles: [
      { id: 6, access: "club", published: 1, coverUrl: url, sections: [] },
    ],
    posts: [
      post(1, {
        target: "club",
        photos: [],
        text: "Body",
        richText: [
          { type: "paragraph", children: [{ text: "File", link: url }] },
        ],
      }),
    ],
    media: [],
    comments: [{ id: 8, postId: 1, photos: [url] }],
  });
  expect(report.groups).toEqual([
    {
      urlHash: createHash("sha256").update(url).digest("hex"),
      visibility: "shared",
      references: [
        "articles:6.coverUrl",
        "posts:1.richText:0.children:0.link",
        "post_comments:8.photos:0",
      ],
    },
  ]);
  expect(report.issues).toEqual([]);
  expect(report.scope).toBe("content-references-partial-no-object-inventory");
});
it("retains raw text URL candidates with an explicit non-rendered-link diagnostic", () => {
  const report = collect({
    posts: [post(1, { photos: [], text: `Download ${url}`, richText: null })],
    media: [],
  });
  expect(report.groups[0]).toMatchObject({
    visibility: "public",
    references: ["posts:1.text.candidate:0"],
  });
  expect(report.issues).toEqual(["posts:1.text.candidates-not-rendered-links"]);
});
it("preserves malformed rich-text and unmatched comment diagnostics without disclosing input", () => {
  const report = collect({
    posts: [
      post(1, {
        photos: [],
        richText: [
          { type: "paragraph", children: [{ text: "PRIVATE_VALUE", link: 3 }] },
        ],
      }),
    ],
    media: [],
    comments: [{ id: 8, postId: 99, photos: [url] }],
  });
  expect(report.groups).toEqual([
    {
      urlHash: createHash("sha256").update(url).digest("hex"),
      visibility: "unknown",
      references: ["post_comments:8.photos:0"],
    },
  ]);
  expect(report.issues).toEqual([
    "posts:1.richText:0.children:0.link.invalid-url",
    "post_comments:8.parent-not-in-snapshot",
  ]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE_VALUE");
});

it("keeps comments on feed posts restricted and accepts nullable or SQL JSON photos", () => {
  const report = collect({
    posts: [post(1, { photos: [] })],
    media: [],
    comments: [
      { id: 8, postId: 1, photos: JSON.stringify([url]) },
      { id: 9, postId: 1, photos: null },
    ],
  });
  expect(report.groups).toEqual([
    {
      urlHash: createHash("sha256").update(url).digest("hex"),
      visibility: "restricted",
      references: ["post_comments:8.photos:0"],
    },
  ]);
  expect(report.issues).toEqual([]);
});
it("rejects duplicate comment identities instead of silently merging locations", () => {
  expect(() =>
    collect({
      posts: [post(1)],
      media: [],
      comments: [
        { id: 8, postId: 1, photos: [] },
        { id: 8, postId: 1, photos: [url] },
      ],
    }),
  ).toThrow("Invalid post snapshot");
});

it("diagnoses empty photo array elements instead of approving missing references", () => {
  expect(
    collect({ posts: [post(1, { photos: [""] })], media: [] }).issues,
  ).toEqual(["posts:1.photos:0.invalid-url"]);
});

it("preserves public avatars, published videos and seasonal decoration when also referenced by club content", () => {
  const report = collect({
    posts: [post(1, { target: "club" })],
    media: [],
    decoration: {
      avatars: [{ id: 4, avatarUrl: url }],
      videos: [{ id: 5, published: 1, thumbnailUrl: url, videoUrl: null }],
      seasons: [{ season: "winter", backgroundUrl: url, bannerUrl: null }],
    },
  });
  expect(report.groups[0]).toEqual({
    urlHash: createHash("sha256").update(url).digest("hex"),
    visibility: "shared",
    references: [
      "posts:1.photos:0",
      "users:4.avatarUrl",
      "videos:5.thumbnailUrl",
      "launch_settings.seasons:winter.backgroundUrl",
    ],
  });
  expect(report.issues).toEqual([]);
});
it("keeps unpublished video links restricted rather than privatizing the public catalog", () => {
  const report = collect({
    posts: [],
    media: [],
    decoration: {
      avatars: [],
      seasons: [],
      videos: [{ id: 5, published: 0, thumbnailUrl: null, videoUrl: url }],
    },
  });
  expect(report.groups[0]).toMatchObject({
    visibility: "restricted",
    references: ["videos:5.videoUrl"],
  });
});
it("rejects duplicate decoration identities and unintended personal fields", () => {
  const input = {
    posts: [],
    media: [],
    decoration: {
      avatars: [
        { id: 4, avatarUrl: url },
        { id: 4, avatarUrl: null },
      ],
      videos: [],
      seasons: [],
    },
  };
  expect(() => collect(input)).toThrow("Invalid post snapshot");
  expect(() =>
    collect({
      ...input,
      decoration: {
        ...input.decoration,
        avatars: [{ id: 4, avatarUrl: url, email: "PRIVATE_VALUE" }],
      },
    }),
  ).toThrow("Invalid post snapshot");
});
