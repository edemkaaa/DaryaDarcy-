import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AddressInfo } from "node:net";
import type { RowDataPacket } from "mysql2/promise";

/** Проверяет восстановление публичных avatar/cover операций после потери ответа без дублирования объекта или повторной привязки. */
describe.skipIf(!testDatabaseUrl)(
  "public photo recovery over native HTTP/SQL/loopback S3",
  () => {
    const baseId = 946000;
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>,
      wire: Awaited<ReturnType<typeof openPrivateUploadWire>>,
      base64: string;
    /** Удаляет receipts только собственного диапазона участников при наличии таблицы. */
    async function clearReceipts() {
      const [tables] = await fixture.conn.query(
        "SHOW TABLES LIKE 'public_photo_uploads'",
      );
      if ((tables as unknown[]).length)
        await fixture.conn.query(
          "DELETE FROM public_photo_uploads WHERE actorUserId BETWEEN ? AND ?",
          [baseId, baseId + 3],
        );
    }
    /** Вызывает upload/status нужного purpose с новым JWT выбранного actor и переданным operation-key. */
    async function call(
      purpose: "avatar" | "publicCover",
      mode: "upload" | "status",
      key: string,
      actor: number | null = 0,
      extra: object = {},
    ) {
      const method =
        purpose === "avatar"
          ? mode === "upload"
            ? "profile.uploadAvatarWithReceipt"
            : "profile.avatarUploadStatus"
          : mode === "upload"
            ? "admin.uploadPublicCover"
            : "admin.publicCoverUploadStatus";
      const token =
        actor === null
          ? null
          : await sdk.createSessionToken(`public-receipts-${actor}`, {
              sessionVersion: 0,
            });
      const input = {
        idempotencyKey: key,
        ...(mode === "upload"
          ? {
              base64,
              filename: "fixture.png",
              mimeType: "image/png",
              ...(purpose === "publicCover" ? { purpose } : {}),
            }
          : {}),
        ...extra,
      };
      const appUrl = `http://127.0.0.1:${(fixture.app.getHttpServer().address() as AddressInfo).port}`;
      const response = await fetch(
        appUrl +
          "/api/trpc/" +
          method +
          (mode === "status"
            ? "?input=" + encodeURIComponent(JSON.stringify({ json: input }))
            : ""),
        {
          method: mode === "upload" ? "POST" : "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
          ...(mode === "upload"
            ? { body: JSON.stringify({ json: input }) }
            : {}),
        },
      );
      const data = await response.json();
      return { status: response.status, data: data.result?.data?.json };
    }
    /** Создаёт loopback public-photo storage и изолированный API-fixture с маленьким synthetic PNG. */
    beforeAll(async () => {
      wire = await openPrivateUploadWire({ publicPhotos: true });
      for (const [key, value] of Object.entries({
        S3_ENDPOINT: wire.endpoint,
        S3_BUCKET: wire.bucket,
        S3_ACCESS_KEY: "fixture-only",
        S3_SECRET_KEY: "fixture-only-secret",
      }))
        vi.stubEnv(key, value);
      fixture = await openListPageFixture("public-receipts", baseId);
      base64 = (
        await sharp({
          create: { width: 16, height: 16, channels: 3, background: "green" },
        })
          .png()
          .toBuffer()
      ).toString("base64");
    });
    /** Очищает свои receipts, fixture, объекты wire и счётчик внешних эффектов. */
    beforeEach(async () => {
      await clearReceipts();
      await fixture.reset();
      wire.objects.clear();
      wire.effects.length = 0;
    });
    /** Удаляет свои receipts, закрывает API и wire и возвращает окружение. */
    afterAll(async () => {
      if (fixture) {
        await clearReceipts();
        await fixture.close();
      }
      await wire?.close();
      vi.unstubAllEnvs();
    });
    /** Потеря PUT-ACK оставляет pending; повтор того же owner/purpose/key подтверждает единственный объект, изменённый payload конфликтует. */
    it.each(["avatar", "publicCover"] as const)(
      "recovers %s after lost PUT ACK without duplicate object or a new operation",
      async (purpose) => {
        const actor = purpose === "avatar" ? 0 : 2,
          key = randomUUID();
        wire.dropPutAck();
        expect((await call(purpose, "upload", key, actor)).status).toBe(503);
        expect((await call(purpose, "status", key, actor)).data).toEqual({
          state: "pending",
        });
        const recovered = await call(purpose, "upload", key, actor);
        expect(recovered.status).toBe(200);
        expect(recovered.data.state).toBe("ready");
        expect(wire.objects.size).toBe(1);
        expect(
          wire.effects.filter((effect) => effect.startsWith("PUT ")),
        ).toHaveLength(1);
        expect((await call(purpose, "status", key, actor)).data).toEqual(
          recovered.data,
        );
        expect((await call(purpose, "upload", key, actor)).data).toEqual(
          recovered.data,
        );
        expect(
          wire.effects.filter((effect) => effect.startsWith("PUT ")),
        ).toHaveLength(1);
        const changed = (
          await sharp({
            create: { width: 16, height: 16, channels: 3, background: "red" },
          })
            .png()
            .toBuffer()
        ).toString("base64");
        expect(
          (await call(purpose, "upload", key, actor, { base64: changed }))
            .status,
        ).toBe(409);
        expect((await call("avatar", "status", key, 1)).data).toEqual({
          state: "missing",
        });
        expect(
          wire.effects.some((effect) => effect.startsWith("DELETE ")),
        ).toBe(false);
      },
    );
    /** Позднее окончание прежней загрузки не затирает более новый аватар и явно возвращает avatarApplied=false. */
    it("does not rebind an old recovered/replayed avatar over a newer selection", async () => {
      const oldKey = randomUUID(),
        newKey = randomUUID(),
        gate = wire.pausePut();
      const old = call("avatar", "upload", oldKey);
      await gate.entered;
      const newer = await call("avatar", "upload", newKey);
      expect(newer.status).toBe(200);
      gate.release();
      const stale = await old;
      expect(stale.data).toMatchObject({
        state: "ready",
        avatarApplied: false,
        isCurrent: false,
      });
      expect((await call("avatar", "upload", oldKey)).data).toEqual(stale.data);
      const [rows] = await fixture.conn.query(
        "SELECT avatarUrl, profileRevision FROM users WHERE id=?",
        [baseId],
      );
      expect(rows).toEqual([{ avatarUrl: newer.data.url, profileRevision: 1 }]);
    });
    /** Принятый avatar увеличивает profileRevision единожды, блокируя старую форму профиля. */
    it("increments the profile revision once and rejects a stale avatar edit", async () => {
      const key = randomUUID();
      const uploaded = await call("avatar", "upload", key);
      expect(uploaded.status).toBe(200);
      expect(uploaded.data).toMatchObject({ state: "ready", avatarApplied: true });

      const token = await sdk.createSessionToken("public-receipts-0", {
        sessionVersion: 0,
      });
      const { port } = fixture.app.getHttpServer().address() as AddressInfo;
      const stale = await fetch(`http://127.0.0.1:${port}/api/trpc/profile.update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: {
            expectedRevision: 0,
            avatarUrl: "https://assets.example.test/old-form-avatar.webp",
          },
        }),
      });
      expect(stale.status).toBe(409);
      expect(await call("avatar", "status", key)).toEqual(uploaded);
      expect(await call("avatar", "upload", key)).toEqual(uploaded);
      const [rows] = await fixture.conn.query<RowDataPacket[]>(
        "SELECT avatarUrl, profileRevision FROM users WHERE id=?",
        [baseId],
      );
      expect(rows).toEqual([{ avatarUrl: uploaded.data.url, profileRevision: 1 }]);
      expect(wire.effects.filter(effect => effect.startsWith("PUT "))).toHaveLength(1);
    });
    /** Права и формат проверяются до PUT, текущая роль повторно проверяется после storage перед ready-commit. */
    it("keeps authorisation and input checks before storage; current role is rechecked after PUT", async () => {
      const key = randomUUID();
      expect((await call("avatar", "upload", key, null)).status).toBe(401);
      expect((await call("publicCover", "upload", key, 0)).status).toBe(403);
      expect((await call("publicCover", "upload", key, 3)).status).toBe(403);
      expect((await call("avatar", "upload", "bad-key")).status).toBe(400);
      // Larger than the ordinary 256KiB parser, but still below the photo quota.
      for (const [purpose, actor] of [
        ["avatar", 0],
        ["publicCover", 2],
      ] as const)
        expect(
          (
            await call(purpose, "upload", randomUUID(), actor, {
              base64: "A".repeat(300 * 1024),
            })
          ).status,
        ).toBe(400);
      expect(wire.effects).toEqual([]);
      const gate = wire.pausePut(),
        pending = call("publicCover", "upload", key, 2);
      await gate.entered;
      await fixture.conn.query("UPDATE users SET role='user' WHERE id=?", [
        baseId + 2,
      ]);
      gate.release();
      expect((await pending).status).toBe(403);
      expect((await call("publicCover", "status", key, 2)).status).toBe(403);
    });
    /** Конкурентный повтор создаёт один объект, но одинаковый UUID другого owner или purpose имеет независимый namespace. */
    it("serializes simultaneous retries and scopes the same operation key to its owner/purpose", async () => {
      const key = randomUUID();
      const [a, b] = await Promise.all([
        call("avatar", "upload", key),
        call("avatar", "upload", key),
      ]);
      expect(a.status).toBe(200);
      expect(b.data).toEqual(a.data);
      expect(wire.objects.size).toBe(1);
      const [rows] = await fixture.conn.query(
        "SELECT profileRevision FROM users WHERE id=?",
        [baseId],
      );
      expect(rows).toEqual([{ profileRevision: 1 }]);
      const other = await call("avatar", "upload", key, 1);
      expect(other.status).toBe(200);
      expect(other.data.url).not.toBe(a.data.url);
      expect(wire.objects.size).toBe(2);
      const cover = await call("publicCover", "upload", key, 2);
      expect(cover.status).toBe(200);
      expect(cover.data).toMatchObject({
        avatarApplied: false,
        isCurrent: null,
      });
      expect(wire.objects.size).toBe(3);
    });
    /** Новый Node-процесс восстанавливает durable receipt, а replay старого avatar не меняет позднейший выбор и не удаляет объект. */
    it("replays a stored result after a lost application reply without rebinding or deleting anything", async () => {
      const key = randomUUID();
      await call("avatar", "upload", key); // Deliberately discard the committed reply.
      const recovered = await call("avatar", "status", key);
      expect(recovered.data.state).toBe("ready");
      const script = `const {publicPhotoStatus}=require('./apps/backend/src/media/public-photo-receipts');const {getDb}=require('./apps/backend/src/db');(async()=>{try{console.log(JSON.stringify(await publicPhotoStatus({id:${baseId},sessionVersion:0},'avatar',${JSON.stringify(key)})));}finally{await(await getDb())?.$client.end();}})().catch(()=>{process.exitCode=1;});`;
      const child = await promisify(execFile)(
        process.execPath,
        ["--require", "tsx/cjs", "--eval", script],
        {
          cwd: fileURLToPath(new URL("../", import.meta.url)),
          timeout: 15000,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            DATABASE_URL: testDatabaseUrl!,
          },
        },
      );
      expect(JSON.parse(child.stdout)).toEqual(recovered.data);
      await fixture.conn.query(
        "UPDATE users SET avatarUrl='https://example.test/later.webp' WHERE id=?",
        [baseId],
      );
      const replay = await call("avatar", "upload", key);
      expect(replay.data).toMatchObject({
        url: recovered.data.url,
        avatarApplied: true,
        isCurrent: false,
      });
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
      expect(wire.effects.some((effect) => effect.startsWith("DELETE "))).toBe(
        false,
      );
    });
    /** Отказ ready-commit сохраняет pending и прежний профиль; retry после снятия trigger привязывает тот же объект. */
    it("recovers a failed SQL bind after PUT using the same object", async () => {
      const key = randomUUID();
      await fixture.conn.query(
        "CREATE TRIGGER public_receipt_refusal BEFORE UPDATE ON public_photo_uploads FOR EACH ROW BEGIN IF NEW.state='ready' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture refusal'; END IF; END",
      );
      try {
        expect((await call("avatar", "upload", key)).status).toBe(503);
        expect((await call("avatar", "status", key)).data).toEqual({
          state: "pending",
        });
        const [rows] = await fixture.conn.query(
          "SELECT avatarUrl, profileRevision FROM users WHERE id=?",
          [baseId],
        );
        expect(rows).toEqual([{ avatarUrl: null, profileRevision: 0 }]);
      } finally {
        await fixture.conn.query("DROP TRIGGER public_receipt_refusal");
      }
      const retried = await call("avatar", "upload", key);
      expect(retried.data).toMatchObject({
        state: "ready",
        isCurrent: true,
      });
      const [rows] = await fixture.conn.query(
        "SELECT avatarUrl, profileRevision FROM users WHERE id=?",
        [baseId],
      );
      expect(rows).toEqual([{ avatarUrl: retried.data.url, profileRevision: 1 }]);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
    });
    /** Retirement удаляет owner-связь receipt и запрещает старый ключ без удаления уже сохранённого объекта. */
    it("anonymizes receipt ownership on account retirement without touching stored objects", async () => {
      const key = randomUUID();
      await call("avatar", "upload", key);
      const { retirePublicPhotoReceipts } =
        await import("../apps/backend/src/media/public-photo-receipts");
      const { getDb } = await import("../apps/backend/src/db");
      await (await getDb())!.transaction(async (tx) => {
        await tx.execute(
          (await import("drizzle-orm"))
            .sql`SELECT id FROM users WHERE id=${baseId} FOR UPDATE`,
        );
        await retirePublicPhotoReceipts(tx, baseId);
      });
      expect((await call("avatar", "status", key)).data).toEqual({
        state: "missing",
      });
      expect((await call("avatar", "upload", key)).status).toBe(409);
      expect(wire.objects.size).toBe(1);
      await fixture.conn.query(
        "DELETE FROM public_photo_uploads WHERE actorUserId IS NULL AND requestId=?",
        [
          (await import("node:crypto"))
            .createHash("sha256")
            .update(JSON.stringify(["public-photo:v1", baseId, "avatar", key]))
            .digest("hex"),
        ],
      );
    });
  },
);
