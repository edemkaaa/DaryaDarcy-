import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import {
  applyLegacyAudioRepair,
  rollbackLegacyAudioRepair,
} from "../tooling/data/legacy-audio-repair";

describe.skipIf(!testDatabaseUrl)(
  "atomic legacy audio replacement on disposable MySQL",
  () => {
    let db: Connection;
    let changes: any[];
    const ids = [9460, 9461];
    const assets = ids.map(
      (id) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    );
    const clean = async () => {
      await db.query(
        "DELETE FROM private_attachment_uploads WHERE mediaId IN (9460,9461) OR assetId IN (?,?)",
        assets,
      );
      await db.query("DELETE FROM admin_audit_log WHERE actorUserId=9460");
      await db.query("DELETE FROM post_media WHERE id IN (9460,9461)");
      await db.query("DELETE FROM posts WHERE id IN (9460,9461)");
      await db.query("DELETE FROM users WHERE id=9460");
    };
    beforeAll(async () => {
      const schema = await openContentTestDatabase();
      await schema.end();
      db = await mysql.createConnection({
        uri: testDatabaseUrl!,
        dateStrings: true,
        timezone: "Z",
      });
    });
    beforeEach(async () => {
      await clean();
      await db.query(
        "INSERT INTO users (id,openId,role) VALUES (9460,'audio-repair-test-admin','admin')",
      );
      for (const id of ids) {
        await db.query(
          "INSERT INTO posts (id,text,photos,tags,source,target,published,status) VALUES (?,'Unchanged podcast',JSON_ARRAY(),JSON_ARRAY(),'telegram','club',1,'published')",
          [id],
        );
        await db.query(
          "INSERT INTO post_media (id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder) VALUES (?,?,'audio',?,'recording.m4a','audio/mpeg',NULL,1305,7)",
          [
            id,
            id,
            `https://s3.twcstorage.ru/daryadarcy-s3/club/tg/${id}/recording.m4a`,
          ],
        );
      }
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      changes = rows.map((row, i) => ({
        before: { ...row },
        duration: 1305,
        asset: {
          assetId: assets[i],
          requestKey: String(i + 1).repeat(64),
          payloadHash: "a".repeat(64),
          namespaceHash: "b".repeat(64),
          etag: '"audio-test-etag"',
          fileSize: 16000000,
        },
      }));
    });
    afterAll(async () => {
      if (db) {
        await clean();
        await db.end();
      }
    });

    it("keeps original media IDs, post bodies, order and dates while binding ready private copies", async () => {
      const [postsBefore] = await db.query(
        "SELECT * FROM posts WHERE id IN (9460,9461) ORDER BY id",
      );
      const [usersBefore] = await db.query("SELECT * FROM users WHERE id=9460");
      expect(await applyLegacyAudioRepair(db, 9460, changes)).toEqual({
        replayed: false,
        mediaIds: ids,
      });
      const [media] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      for (const [i, row] of media.entries())
        expect({ ...row }).toEqual({
          ...changes[i].before,
          url: `/api/media/post-attachments/${row.id}`,
          mimeType: "audio/mp4",
          fileSize: 16000000,
          duration: 1305,
        });
      expect(
        (
          await db.query(
            "SELECT * FROM posts WHERE id IN (9460,9461) ORDER BY id",
          )
        )[0],
      ).toEqual(postsBefore);
      expect((await db.query("SELECT * FROM users WHERE id=9460"))[0]).toEqual(
        usersBefore,
      );
      const [receipts] = await db.query<RowDataPacket[]>(
        "SELECT state,postId,mediaId FROM private_attachment_uploads WHERE mediaId IN (9460,9461) ORDER BY mediaId",
      );
      expect(receipts).toEqual(
        ids.map((id) => ({ state: "ready", postId: id, mediaId: id })),
      );
    });

    it("reconciles a lost acknowledgement without duplicate assets or audit writes", async () => {
      await applyLegacyAudioRepair(db, 9460, changes);
      expect(await applyLegacyAudioRepair(db, 9460, changes)).toEqual({
        replayed: true,
        mediaIds: ids,
      });
      const [counts] = await db.query<RowDataPacket[]>(
        "SELECT (SELECT COUNT(*) FROM private_attachment_uploads WHERE mediaId IN (9460,9461)) AS receipts,(SELECT COUNT(*) FROM admin_audit_log WHERE actorUserId=9460) AS audits",
      );
      expect(counts[0]).toEqual({ receipts: 2, audits: 2 });
    });

    it("rolls back the entire batch when the last source row changed", async () => {
      await db.query("UPDATE post_media SET sortOrder=9 WHERE id=9461");
      await expect(applyLegacyAudioRepair(db, 9460, changes)).rejects.toThrow();
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      expect({ ...rows[0] }).toEqual(changes[0].before);
      expect(rows[1].sortOrder).toBe(9);
      const [assets] = await db.query<RowDataPacket[]>(
        "SELECT * FROM private_attachment_uploads WHERE mediaId IN (9460,9461)",
      );
      expect(assets).toHaveLength(0);
    });

    it("does not apply the first row when the second receipt collides", async () => {
      await db.query(
        "INSERT INTO private_attachment_uploads (requestKey,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize,state) VALUES (?,?,?,?,'audio','other.m4a','audio/mp4',1,'ready')",
        [
          changes[1].asset.requestKey,
          assets[1],
          "c".repeat(64),
          "d".repeat(64),
        ],
      );
      await expect(applyLegacyAudioRepair(db, 9460, changes)).rejects.toThrow();
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      expect(rows.map((row) => ({ ...row }))).toEqual(
        changes.map((c) => c.before),
      );
    });

    it("rolls back earlier media, receipts and audits after a real SQL failure on the final update", async () => {
      await db.query(
        "CREATE TRIGGER audio_repair_fixture_failure BEFORE UPDATE ON post_media FOR EACH ROW BEGIN IF NEW.id=9461 AND NEW.mimeType='audio/mp4' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='audio fixture failure'; END IF; END",
      );
      try {
        await expect(applyLegacyAudioRepair(db, 9460, changes)).rejects.toThrow(
          "audio fixture failure",
        );
        const [rows] = await db.query<RowDataPacket[]>(
          "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
        );
        expect(rows.map((row) => ({ ...row }))).toEqual(
          changes.map((c) => c.before),
        );
        const [counts] = await db.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM private_attachment_uploads WHERE mediaId IN (9460,9461)) AS receipts,(SELECT COUNT(*) FROM admin_audit_log WHERE actorUserId=9460) AS audits",
        );
        expect(counts[0]).toEqual({ receipts: 0, audits: 0 });
      } finally {
        await db.query("DROP TRIGGER audio_repair_fixture_failure");
      }
    });

    it("refuses blocked actors, non-club posts, and renditions beyond the existing 32 MiB quota", async () => {
      await db.query(
        "UPDATE users SET blockedAt=UTC_TIMESTAMP() WHERE id=9460",
      );
      await expect(applyLegacyAudioRepair(db, 9460, changes)).rejects.toThrow();
      await db.query("UPDATE users SET blockedAt=NULL WHERE id=9460");
      await db.query("UPDATE posts SET target='feed' WHERE id=9461");
      await expect(applyLegacyAudioRepair(db, 9460, changes)).rejects.toThrow();
      await db.query("UPDATE posts SET target='club' WHERE id=9461");
      await expect(
        applyLegacyAudioRepair(db, 9460, [
          {
            ...changes[0],
            asset: { ...changes[0].asset, fileSize: 32 * 1024 * 1024 + 1 },
          },
        ]),
      ).rejects.toThrow();
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      expect(rows.map((row) => ({ ...row }))).toEqual(
        changes.map((c) => c.before),
      );
    });

    it("restores only unchanged own bindings and retains an audit trail", async () => {
      await applyLegacyAudioRepair(db, 9460, changes);
      expect(await rollbackLegacyAudioRepair(db, 9460, changes)).toEqual({
        replayed: false,
        mediaIds: ids,
      });
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      expect(rows.map((row) => ({ ...row }))).toEqual(
        changes.map((c) => c.before),
      );
      expect(await rollbackLegacyAudioRepair(db, 9460, changes)).toEqual({
        replayed: true,
        mediaIds: ids,
      });
      const [audit] = await db.query<RowDataPacket[]>(
        "SELECT action FROM admin_audit_log WHERE actorUserId=9460 ORDER BY id",
      );
      expect(audit.map((row) => row.action)).toEqual([
        "repair_legacy_audio",
        "repair_legacy_audio",
        "rollback_legacy_audio",
        "rollback_legacy_audio",
      ]);
    });

    it("refuses rollback after later edits instead of discarding the edit", async () => {
      await applyLegacyAudioRepair(db, 9460, changes);
      await db.query(
        "UPDATE post_media SET filename='later-edit.m4a' WHERE id=9461",
      );
      await expect(
        rollbackLegacyAudioRepair(db, 9460, changes),
      ).rejects.toThrow();
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT url,filename FROM post_media WHERE id IN (9460,9461) ORDER BY id",
      );
      expect(rows[0].url).toBe("/api/media/post-attachments/9460");
      expect(rows[1].filename).toBe("later-edit.m4a");
    });
  },
);
