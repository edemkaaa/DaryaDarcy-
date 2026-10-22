import { describe, expect, it } from "vitest";
import { prepareLegacyClubContent } from "../tooling/data/legacy-club-import";

const photo = "https://s3.twcstorage.ru/daryadarcy-s3/club/example/photo.jpg";
function source() {
  const post = {
    id: 10,
    text: "",
    photos: JSON.stringify([photo]),
    tags: '["exclusive"]',
    source: "telegram",
    instagramId: "tg-123",
    sortOrder: 7,
    published: 1,
    status: "published",
    target: "club",
    scheduledAt: null as string | null,
    publishedAt: null,
    createdAt: "2026-09-01 10:00:00",
    updatedAt: "2026-09-02 11:00:00",
    richText: JSON.stringify([
      {
        type: "paragraph",
        children: [
          {
            text: "Formatted",
            bold: true,
            italic: true,
            link: "https://example.test/",
          },
        ],
      },
    ]),
  };
  return {
    sourceSha256: "a".repeat(64),
    posts: [
      post,
      {
        ...post,
        id: 11,
        text: "Article",
        source: "article:1",
        instagramId: null,
      },
    ],
    articles: [
      {
        id: 1,
        title: "Original article",
        coverUrl: photo,
        access: "public",
        published: 1,
        sortOrder: 0,
        sections: JSON.stringify([
          { type: "heading", text: "Title" },
          { type: "photo", url: photo },
        ]),
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    ],
    media: [
      {
        id: 20,
        postId: 10,
        type: "audio",
        url: "https://s3.twcstorage.ru/daryadarcy-s3/club/example/audio.mp3",
        filename: "audio.mp3",
        mimeType: "audio/mpeg",
        fileSize: 3,
        duration: null,
        sortOrder: 0,
        createdAt: post.createdAt,
      },
    ],
    tags: [],
  };
}
describe("legacy Club content boundary", () => {
  it("retains photo-only posts, formatting, original dates and a public article", () => {
    const result = prepareLegacyClubContent(source());
    expect(result.posts[0]).toMatchObject({
      id: 10,
      text: "",
      photos: [photo],
      tags: ["exclusive"],
      source: "telegram",
      instagramId: "tg-123",
      createdAt: "2026-09-01 10:00:00",
      updatedAt: "2026-09-02 11:00:00",
    });
    expect(result.posts[0].richText).toEqual([
      {
        type: "paragraph",
        children: [
          {
            text: "Formatted",
            bold: true,
            italic: true,
            link: "https://example.test/",
          },
        ],
      },
    ]);
    expect(result.articles[0]).toMatchObject({
      access: "public",
      sections: [
        { type: "heading", text: "Title" },
        { type: "photo", url: photo },
      ],
    });
    expect(result.media[0]).toMatchObject({ id: 20, postId: 10, fileSize: 3 });
    expect(result).not.toHaveProperty("tags");
  });
  it.each(["draft", "scheduled"])(
    "preserves %s rather than publishing it during import",
    (status) => {
      const input = source();
      input.posts[0].status = status;
      input.posts[0].published = 0;
      input.posts[0].scheduledAt =
        status === "scheduled" ? "2026-09-03 08:00:00" : null;
      expect(prepareLegacyClubContent(input).posts[0]).toMatchObject({
        status,
        published: 0,
      });
    },
  );
  it("rejects a media row with no source post", () => {
    const input = source();
    input.media[0].postId = 999;
    expect(() => prepareLegacyClubContent(input)).toThrow(
      "Invalid legacy Club snapshot",
    );
  });
  it("rejects duplicate source IDs and dangling article cards", () => {
    const duplicate = source();
    duplicate.posts.push({ ...duplicate.posts[0] });
    expect(() => prepareLegacyClubContent(duplicate)).toThrow(
      "Invalid legacy Club snapshot",
    );
    const dangling = source();
    dangling.posts[1].source = "article:999";
    expect(() => prepareLegacyClubContent(dangling)).toThrow(
      "Invalid legacy Club snapshot",
    );
  });
  it.each([
    "http://127.0.0.1/file",
    "https://s3.twcstorage.ru.evil.test/file",
    photo + "?signature=private",
  ])("rejects unsupported media URL %s", (url) => {
    const input = source();
    input.posts[0].photos = JSON.stringify([url]);
    expect(() => prepareLegacyClubContent(input)).toThrow(
      "Invalid legacy Club snapshot",
    );
  });
  it("refuses public-feed rows, invalid dates and unrelated account data", () => {
    const feed = source();
    feed.posts[0].target = "feed";
    expect(() => prepareLegacyClubContent(feed)).toThrow(
      "Invalid legacy Club snapshot",
    );
    const date = source();
    date.articles[0].createdAt = "2026-02-31 10:00:00";
    expect(() => prepareLegacyClubContent(date)).toThrow(
      "Invalid legacy Club snapshot",
    );
    expect(() =>
      prepareLegacyClubContent({ ...source(), users: [{ id: 1 }] }),
    ).toThrow("Invalid legacy Club snapshot");
  });
});
