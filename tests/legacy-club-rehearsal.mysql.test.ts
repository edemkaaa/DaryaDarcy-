import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql, { type Connection } from "mysql2/promise";
import { prepareLegacyClubContent } from "../tooling/data/legacy-club-import";
import {
  planLegacyClubRehearsal,
  applyLegacyClubRehearsal,
  rollbackLegacyClubMerge,
} from "../tooling/data/legacy-club-rehearsal";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const uri = process.env.LEGACY_CLUB_TEST_URL;
const containerId = process.env.LEGACY_CLUB_TEST_CONTAINER_ID;
const photo = "https://s3.twcstorage.ru/daryadarcy-s3/club/rehearsal/photo.jpg";
const stamp = "2026-09-01 12:00:00";
const content = prepareLegacyClubContent({
  sourceSha256: "b".repeat(64),
  posts: [
    {
      id: 10,
      text: "Original",
      photos: [photo],
      tags: ["exclusive"],
      source: "article:1",
      instagramId: null,
      sortOrder: 1,
      published: 1,
      status: "published",
      target: "club",
      scheduledAt: null,
      publishedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
      richText: null,
    },
  ],
  articles: [
    {
      id: 1,
      title: "Original",
      coverUrl: photo,
      access: "public",
      published: 1,
      sortOrder: 1,
      sections: [{ type: "photo", url: photo }],
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
  media: [
    {
      id: 5,
      postId: 10,
      type: "audio",
      url: "https://s3.twcstorage.ru/daryadarcy-s3/club/rehearsal/audio.mp3",
      filename: "audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 123,
      duration: null,
      sortOrder: 0,
      createdAt: stamp,
    },
  ],
});

describe("legacy Club rehearsal target guard", () => {
  it.each([
    "mysql://root@127.0.0.1/live",
    "mysql://root@db.example.test/backend_test",
  ])("refuses %s before any SQL", async (uri) => {
    await expect(
      planLegacyClubRehearsal({ uri, containerId: "0".repeat(64) }, content),
    ).rejects.toThrow(/fixture|disposable/i);
  });
});

describe.skipIf(!uri || !containerId)(
  "legacy Club transaction on an owned restored database",
  () => {
    let connection: Connection;
    const target = { uri: uri!, containerId: containerId! };
    let plan: Awaited<ReturnType<typeof planLegacyClubRehearsal>>;
    beforeAll(async () => {
      assertTestDatabase(uri!);
      plan = await planLegacyClubRehearsal(target, content);
      connection = await mysql.createConnection({
        uri: uri!,
        dateStrings: true,
        jsonStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
        timezone: "Z",
      });
    }, 20000);
    afterAll(async () => {
      if (!connection) return;
      await connection.query(
        "DROP TRIGGER IF EXISTS legacy_club_rehearsal_fault",
      );
      if (plan) {
        await connection.execute("DELETE FROM post_media WHERE id=?", [
          plan.ids.post_media[5],
        ]);
        await connection.execute("DELETE FROM posts WHERE id=?", [
          plan.ids.posts[10],
        ]);
        await connection.execute("DELETE FROM articles WHERE id=?", [
          plan.ids.articles[1],
        ]);
      }
      await connection.end();
    });
    it("rolls back article and post writes when the final media insert fails", async () => {
      await connection.query(
        "CREATE TRIGGER legacy_club_rehearsal_fault BEFORE INSERT ON post_media FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Owned rehearsal injected failure'",
      );
      try {
        await expect(
          applyLegacyClubRehearsal(target, content, plan),
        ).rejects.toThrow();
      } finally {
        await connection.query("DROP TRIGGER legacy_club_rehearsal_fault");
      }
      const after = await planLegacyClubRehearsal(target, content);
      expect(after.baseline).toEqual(plan.baseline);
    }, 20000);
    it("refuses an oversized table instead of fingerprinting a truncated snapshot", async () => {
      await connection.query(
        "CREATE TABLE legacy_club_bounds (id int PRIMARY KEY) ENGINE=InnoDB",
      );
      try {
        await connection.query("INSERT INTO legacy_club_bounds VALUES(1)");
        for (let count = 1; count < 10001; count *= 2)
          await connection.query(
            `INSERT INTO legacy_club_bounds SELECT id+${count} FROM legacy_club_bounds WHERE id+${count}<=10001`,
          );
        await expect(planLegacyClubRehearsal(target, content)).rejects.toThrow(
          /bounds/,
        );
      } finally {
        await connection.query("DROP TABLE legacy_club_bounds");
      }
    }, 20000);
    it("remaps article cards and media, preserves existing rows and tolerates a lost response", async () => {
      const first = await applyLegacyClubRehearsal(target, content, plan);
      expect(first).toMatchObject({
        replayed: false,
        originalRowsUnchanged: true,
        posts: 1,
        articles: 1,
        media: 1,
      });
      expect(
        await applyLegacyClubRehearsal(target, content, plan),
      ).toMatchObject({ replayed: true, originalRowsUnchanged: true });
      const [posts] = await connection.query<any[]>(
        "SELECT * FROM posts WHERE id=?",
        [plan.ids.posts[10]],
      );
      const [articles] = await connection.query<any[]>(
        "SELECT * FROM articles WHERE id=?",
        [plan.ids.articles[1]],
      );
      const [media] = await connection.query<any[]>(
        "SELECT * FROM post_media WHERE id=?",
        [plan.ids.post_media[5]],
      );
      expect(posts[0]).toMatchObject({
        source: `article:${plan.ids.articles[1]}`,
        createdAt: stamp,
      });
      expect(JSON.parse(posts[0].photos)).toEqual([photo]);
      expect(articles[0]).toMatchObject({ access: "public" });
      expect(JSON.parse(articles[0].sections)).toEqual([
        { type: "photo", url: photo },
      ]);
      expect(media[0]).toMatchObject({
        postId: plan.ids.posts[10],
        posterUrl: null,
      });
    }, 20000);
    it("refuses changed source content or target content instead of overwriting it", async () => {
      const changed = structuredClone(content);
      changed.posts[0].text = "Changed";
      await expect(
        applyLegacyClubRehearsal(target, changed, plan),
      ).rejects.toThrow();
      await connection.execute(
        "UPDATE posts SET text='Target edit' WHERE id=?",
        [plan.ids.posts[10]],
      );
      await expect(
        applyLegacyClubRehearsal(target, content, plan),
      ).rejects.toThrow();
    }, 20000);
    it("refuses rollback of edited content, then removes only the unchanged imported rows", async () => {
      await expect(
        rollbackLegacyClubMerge(connection, content, plan),
      ).rejects.toThrow();
      await connection.execute(
        "UPDATE posts SET text='Original',updatedAt=? WHERE id=?",
        [stamp, plan.ids.posts[10]],
      );
      expect(await rollbackLegacyClubMerge(connection, content, plan)).toEqual({
        removed: 3,
        originalRowsUnchanged: true,
      });
      expect((await planLegacyClubRehearsal(target, content)).baseline).toEqual(
        plan.baseline,
      );
    }, 20000);
  },
);
