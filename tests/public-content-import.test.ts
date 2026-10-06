import { describe, expect, it, vi } from "vitest";
import {
  assertStagingDestination,
  importPublicContent,
  preparePublicSnapshot,
} from "../tooling/data/import-public-staging.mjs";

function snapshot() {
  return {
    posts: [
      {
        id: 101,
        text: "A public post",
        photos: ["https://s3.twcstorage.ru/test/photo.jpg"],
        tags: ["home"],
        source: "instagram",
        instagramId: "public-shortcode",
        sortOrder: 10,
        published: true,
        status: "published",
        target: "feed",
        scheduledAt: null,
        publishedAt: null,
        richText: null,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        media: [],
        likeCount: 99,
      },
    ],
    videos: [
      {
        id: 11,
        youtubeId: "abcdefghijk",
        title: "Public video",
        duration: "12:34",
        thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
        videoUrl: null,
        views: "1K",
        publishedText: "1 month ago",
        sortOrder: 0,
        published: true,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
    ],
    tags: [
      { id: 5, slug: "home", label: "Дом", category: "topic", sortOrder: 0 },
    ],
    users: [{ email: "never-import@example.test" }],
  };
}
describe("public-only staging content bootstrap", () => {
  it("preserves public content and dates but excludes users and engagement", () => {
    const prepared = preparePublicSnapshot(snapshot());
    expect(Object.keys(prepared).sort()).toEqual(["posts", "tags", "videos"]);
    expect(prepared.posts[0].id).toBe(101);
    expect(prepared.posts[0].text).toBe("A public post");
    expect(prepared.posts[0].createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(prepared.posts[0].photos).toEqual([
      "https://s3.twcstorage.ru/test/photo.jpg",
    ]);
    expect(prepared.posts[0]).not.toHaveProperty("likeCount");
    expect(prepared.posts[0]).not.toHaveProperty("media");
    expect(prepared.videos[0].youtubeId).toBe("abcdefghijk");
  });
  it.each([
    { target: "club" },
    { target: "both" },
    { published: false },
    { status: "draft" },
    { scheduledAt: "2026-12-01T00:00:00.000Z" },
    { photos: ["http://s3.twcstorage.ru/test/photo.jpg"] },
    { photos: ["https://s3.twcstorage.ru.evil.test/photo.jpg"] },
    { photos: ["https://user:secret@s3.twcstorage.ru/test/photo.jpg"] },
    { media: [{ type: "video", url: "https://example.test/private.mp4" }] },
  ])("refuses unsupported or non-public post %j", (changes) => {
    const data = snapshot();
    Object.assign(data.posts[0], changes);
    expect(() => preparePublicSnapshot(data)).toThrow(
      "Invalid public content snapshot",
    );
  });
  it("refuses duplicate source IDs rather than silently losing records", () => {
    const data = snapshot();
    data.posts.push({ ...data.posts[0] });
    expect(() => preparePublicSnapshot(data)).toThrow(
      "Invalid public content snapshot",
    );
  });
  it("refuses a hidden or non-YouTube catalog record", () => {
    const data = snapshot();
    data.videos[0].published = false;
    expect(() => preparePublicSnapshot(data)).toThrow(
      "Invalid public content snapshot",
    );
    data.videos[0].published = true;
    data.videos[0].youtubeId = "../../private";
    expect(() => preparePublicSnapshot(data)).toThrow(
      "Invalid public content snapshot",
    );
  });
  it("refuses unknown tag references", () => {
    const data = snapshot();
    data.posts[0].tags = ["unknown"];
    expect(() => preparePublicSnapshot(data)).toThrow(
      "Invalid public content snapshot",
    );
  });
  it("permits only the isolated staging database and application origin", () => {
    expect(() =>
      assertStagingDestination(
        "mysql://fixture:synthetic@mysql:3306/daryadarcy_staging",
        "https://daryadarcy.dev.reeskeen.ru",
      ),
    ).not.toThrow();
  });
  it("accepts the staging URL's explicit UTF-8 charset without allowing other driver options", () => {
    expect(() =>
      assertStagingDestination(
        "mysql://fixture:synthetic@mysql/daryadarcy_staging?charset=utf8mb4",
        "https://daryadarcy.dev.reeskeen.ru",
      ),
    ).not.toThrow();
    for (const query of [
      "charset=latin1",
      "charset=utf8mb4&multipleStatements=true",
      "charset=utf8mb4&charset=utf8mb4",
    ]) {
      expect(() =>
        assertStagingDestination(
          `mysql://fixture:synthetic@mysql/daryadarcy_staging?${query}`,
          "https://daryadarcy.dev.reeskeen.ru",
        ),
      ).toThrow("Not the isolated staging destination");
    }
  });
  it.each([
    [
      "mysql://fixture:synthetic@mysql/daryadarcy",
      "https://daryadarcy.dev.reeskeen.ru",
    ],
    [
      "mysql://fixture:synthetic@production.example/daryadarcy_staging",
      "https://daryadarcy.dev.reeskeen.ru",
    ],
    [
      "mysql://fixture:synthetic@mysql/daryadarcy_staging",
      "https://daryadarcy.com",
    ],
    [
      "mysql://fixture:synthetic@mysql/daryadarcy_staging?debug=true",
      "https://daryadarcy.dev.reeskeen.ru",
    ],
    ["not-a-url-CONFIDENTIAL", "https://daryadarcy.dev.reeskeen.ru"],
  ])(
    "refuses unsafe destinations without leaking their credentials",
    (database, app) => {
      expect(() => assertStagingDestination(database, app)).toThrow(
        "Not the isolated staging destination",
      );
      try {
        assertStagingDestination(database, app);
      } catch (error) {
        expect(String(error)).not.toContain("synthetic");
        expect(String(error)).not.toContain("CONFIDENTIAL");
      }
    },
  );
});

describe("transactional content bootstrap", () => {
  const destination = {
    database: "mysql://fixture:synthetic@mysql/daryadarcy_staging",
    app: "https://daryadarcy.dev.reeskeen.ru",
  };
  function connection(occupied = false, failInsert = false) {
    return {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
        if (sql.includes("information_schema"))
          return [
            [
              { TABLE_NAME: "posts", ENGINE: "InnoDB" },
              { TABLE_NAME: "videos", ENGINE: "InnoDB" },
              { TABLE_NAME: "tags", ENGINE: "InnoDB" },
            ],
          ];
        if (sql.startsWith("SELECT id")) return [occupied ? [{ id: 1 }] : []];
        return [[]];
      }),
      execute: vi.fn(async (sql: string, _values: unknown[]) => {
        if (failInsert && sql.includes("`videos`"))
          throw new Error("SQL with CONFIDENTIAL values");
        return [{ affectedRows: 1 }];
      }),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };
  }
  it("defaults to read-only validation, even with a valid destination", async () => {
    const db = connection();
    const report = await importPublicContent(db, snapshot(), destination);
    expect(report).toMatchObject({
      applied: false,
      posts: 1,
      tags: 1,
      videos: 1,
      photos: 1,
    });
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.beginTransaction).not.toHaveBeenCalled();
  });
  it("inserts only the three content tables in one transaction with parameterized values", async () => {
    const db = connection();
    const report = await importPublicContent(db, snapshot(), {
      ...destination,
      apply: true,
    });
    expect(report.applied).toBe(true);
    expect(db.beginTransaction).toHaveBeenCalledOnce();
    expect(db.commit).toHaveBeenCalledOnce();
    expect(db.rollback).not.toHaveBeenCalled();
    expect(
      db.execute.mock.calls.map(
        ([sql]) => sql.match(/INSERT INTO `(\w+)`/)?.[1],
      ),
    ).toEqual(["tags", "posts", "videos"]);
    expect(db.execute.mock.calls[1][0]).not.toContain("A public post");
    expect(db.execute.mock.calls[1][1]).toContain("A public post");
    expect(db.execute.mock.calls[1][1]).toContainEqual(
      new Date("2026-09-01T10:00:00.000Z"),
    );
  });
  it("refuses a non-empty destination without any inserts", async () => {
    const db = connection(true);
    await expect(
      importPublicContent(db, snapshot(), { ...destination, apply: true }),
    ).rejects.toThrow("Content tables are not empty");
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalledOnce();
    expect(db.commit).not.toHaveBeenCalled();
  });
  it("rolls back earlier inserts if the last table fails and hides SQL values", async () => {
    const db = connection(false, true);
    await expect(
      importPublicContent(db, snapshot(), { ...destination, apply: true }),
    ).rejects.toThrow("Public content import failed");
    expect(db.execute).toHaveBeenCalledTimes(3);
    expect(db.rollback).toHaveBeenCalledOnce();
    expect(db.commit).not.toHaveBeenCalled();
    expect(db.query.mock.calls.at(-1)?.[0]).toContain("RELEASE_LOCK");
  });
  it("rejects unsafe targets and snapshots before touching the database", async () => {
    const db = connection();
    await expect(
      importPublicContent(db, snapshot(), {
        ...destination,
        app: "https://daryadarcy.com",
        apply: true,
      }),
    ).rejects.toThrow("Not the isolated staging destination");
    const data = snapshot();
    data.posts[0].target = "club";
    await expect(
      importPublicContent(db, data, { ...destination, apply: true }),
    ).rejects.toThrow("Invalid public content snapshot");
    expect(db.query).not.toHaveBeenCalled();
    expect(db.beginTransaction).not.toHaveBeenCalled();
  });
  it("refuses tables without transactional storage before acquiring a lock", async () => {
    const db = connection();
    db.query.mockResolvedValueOnce([
      [{ TABLE_NAME: "posts", ENGINE: "MyISAM" }],
    ]);
    await expect(
      importPublicContent(db, snapshot(), { ...destination, apply: true }),
    ).rejects.toThrow("Public content import failed");
    expect(db.query).toHaveBeenCalledOnce();
    expect(db.beginTransaction).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("does not start a transaction when another importer holds the lock", async () => {
    const db = connection();
    const original = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql) =>
      sql.includes("GET_LOCK") ? [[{ acquired: 0 }]] : original(sql),
    );
    await expect(
      importPublicContent(db, snapshot(), { ...destination, apply: true }),
    ).rejects.toThrow("Public content import failed");
    expect(db.beginTransaction).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
    expect(
      db.query.mock.calls.some(([sql]) => sql.includes("RELEASE_LOCK")),
    ).toBe(false);
  });
});
