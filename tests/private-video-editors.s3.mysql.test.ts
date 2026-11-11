import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { expect as ui, type Locator, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import superjson from "superjson";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { httpResponseFaultProxy } from "./helpers/http-response-fault-proxy";
import { mp4Fixture } from "./helpers/media-fixtures";

const enabled = process.env.PRIVATE_VIDEO_EDITORS_S3_ACCEPTANCE === "true";
const endpoint = "https://s3.twcstorage.ru",
  Bucket = "daryadarcy-s3";
const policyHash =
  "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
/** Вычисляет хеш принятой bucket policy для проверки её неизменности. */
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const admin = 98940,
  other = 98941,
  member = 98942;
type Mode = "full" | "quick";
/** Находит текстовое поле настоящего полного либо быстрого редактора. */
const field = (form: Locator) =>
  form.getByPlaceholder("Текст поста… Enter — новый абзац");
/** Выбирает кнопку сохранения полного редактора или публикации быстрого. */
const submit = (form: Locator, mode: Mode) =>
  form
    .getByRole("button", {
      name: mode === "full" ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();
/** Находит явное действие восстановления неопределённого сохранения. */
const recover = (form: Locator) =>
  form.getByRole("button", { name: "Проверить сохранение", exact: true });

// Actual UI/File/IndexedDB/Next/Nest/SQL/S3. Only completed HTTP replies are lost/held.
/** Опциональная приёмка проверяет настоящие File, IndexedDB, Next, API, SQL и S3 обоих видеоредакторов. */
describe.skipIf(!enabled)("private videos through both actual editors", () => {
  let conn: Connection, storage: S3Client;
  let workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
  let api: Awaited<ReturnType<typeof workers.start>>;
  let browser: Awaited<ReturnType<typeof privateFilesBrowser>>;
  let proxy: Awaited<ReturnType<typeof httpResponseFaultProxy>>;
  let page: Page;
  const prefix = `vu-browser-${randomUUID()}`,
    tokens = new Map<number, string>();
  const messages: string[] = [],
    errors: string[] = [];
  /** Читает контрольные SQL-строки только отдельной базы сценария. */
  const rows = async (sql: string, args: unknown[] = []) =>
    (await conn.query<RowDataPacket[]>(sql, args))[0];
  /** Считает реальные PUT API-процесса для проверки однократной загрузки видео и постера. */
  const puts = () =>
    api.commands.filter((command) => command === "PutObjectCommand").length;
  /** Отбирает бинарные upload-запросы из fault-proxy. */
  const rawUploads = () =>
    proxy.calls.filter(
      (call) => call.pathname === "/api/admin/private-video-uploads",
    );
  /** Отбирает завершённые вызовы конкретной admin-процедуры. */
  const calls = (method: string) =>
    proxy.calls.filter((call) => call.pathname === `/api/trpc/admin.${method}`);
  /** Формирует уникальное имя синтетического видео по режиму и фазе сценария. */
  const name = (mode: Mode, scenario: string) =>
    `${prefix}-${mode}-${scenario}.mp4`;
  /** Читает durable-квитанции только выбранного синтетического имени файла. */
  const ledger = (filename: string) =>
    rows("SELECT * FROM private_attachment_uploads WHERE filename=?", [
      filename,
    ]);
  /** Устанавливает cookie выбранного синтетического аккаунта в browser context. */
  async function identity(id = admin) {
    await browser.context.addCookies([
      {
        name: COOKIE_NAME,
        value: tokens.get(id)!,
        url: browser.origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  /** Открывает полный или быстрый редактор и при необходимости восстанавливает сохранённый локальный черновик. */
  async function open(mode: Mode, restore = false, editing = false) {
    const response = await page.goto(
      `${browser.origin}${mode === "full" ? "/admin" : editing ? "/club" : "/feed"}`,
      { waitUntil: "load" },
    );
    expect(response?.status()).toBe(200);
    if (editing && mode === "quick")
      await page
        .getByRole("button", { name: "Действия с постом", exact: true })
        .first()
        .click();
    await page
      .getByRole("button", {
        name: editing
          ? "Редактировать пост"
          : mode === "full"
            ? "Новый"
            : "Новый пост",
        exact: true,
      })
      .first()
      .click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    await ui(form).toBeVisible();
    await ui(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(0);
    if (restore)
      await form
        .getByRole("button", { name: "Восстановить черновик", exact: true })
        .click();
    return form;
  }
  /** Передаёт настоящее синтетическое MP4 через filechooser и ждёт готовности выбранного вложения. */
  async function choose(form: Locator, filename: string) {
    const chooser = page.waitForEvent("filechooser");
    await form
      .getByRole("button", { name: "Выбрать видеофайл", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({ name: filename, mimeType: "video/mp4", buffer: mp4Fixture });
    await ui(
      form.getByRole("button", { name: "Удалить видео 1", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
  }
  /** Читает оригинальные байты, имя, ключ и наличие постера из настоящего IndexedDB-журнала конкретного владельца. */
  async function storedVideo(mode: Mode) {
    return page.evaluate(
      ({ admin, mode }) =>
        new Promise<{
          key: string;
          name: string;
          bytes: number[];
          poster: boolean;
        }>((resolve, reject) => {
          const opening = indexedDB.open("darcy-post-drafts", 1);
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const db = opening.result,
              tx = db.transaction("drafts", "readonly");
            const request = tx
              .objectStore("drafts")
              .get(
                `${admin}:${mode === "full" ? "full:new" : "quick:new:feed"}`,
              );
            request.onsuccess = () => {
              const video = request.result?.editor.privateVideos?.[0];
              if (!video) {
                reject(Error("Missing original video journal"));
                return;
              }
              resolve({
                key: video.key,
                name: video.fileData.name,
                bytes: [...new Uint8Array(video.fileData.bytes)],
                poster: !!video.poster,
              });
            };
            tx.oncomplete = () => db.close();
            tx.onerror = () => reject(tx.error);
          };
        }),
      { admin, mode },
    );
  }
  /** Выполняет GET, HEAD либо Range защищённого файла через browser request с текущей cookie. */
  const read = (url: string, method = "GET", range?: string) =>
    browser.context.request.fetch(`${browser.origin}${url}`, {
      method,
      headers: range ? { range } : {},
      timeout: 20000,
    });
  /** Проверяет одинаковый закрытый отказ GET, HEAD и Range без обращения к S3. */
  async function denied(url: string) {
    const before = api.commands.length;
    for (const [method, range] of [
      ["GET", undefined],
      ["HEAD", undefined],
      ["GET", "bytes=2-5"],
    ] as const) {
      const response = await read(url, method, range);
      expect(response.status()).toBe(404);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
    }
    expect(api.commands.length).toBe(before);
  }
  /** Проверяет владение пустым tmpfs-стендом, место и bucket policy; создаёт только синтетические роли и поднимает отдельный browser/API-стенд. */
  beforeAll(async () => {
    const disk = await statfs(tmpdir());
    if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
      throw Error(
        "Native video browser acceptance requires 2 GiB free before writes",
      );
    const uri = process.env.BACKEND_TEST_DATABASE_URL!,
      id = process.env.PRIVATE_EDITORS_DATABASE_CONTAINER_ID;
    const url = assertTestDatabase(uri);
    if (
      !id ||
      !/^[a-f0-9]{64}$/.test(id) ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      process.env.DATABASE_URL !== uri ||
      process.env.S3_ENDPOINT !== endpoint ||
      process.env.S3_BUCKET !== Bucket ||
      !process.env.S3_ACCESS_KEY ||
      !process.env.S3_SECRET_KEY
    )
      throw Error("Explicit owned acceptance inputs required");
    const { stdout } = await promisify(execFile)(
      "docker",
      [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
      ],
      { timeout: 10000 },
    );
    const fixture = JSON.parse(stdout),
      ports = fixture.ports?.["3306/tcp"];
    if (
      fixture.id !== id ||
      !/^daryadarcy-fresh-video-browser-[a-z0-9-]+$/.test(fixture.owner) ||
      fixture.name !== `/${fixture.owner}` ||
      !fixture.tmpfs?.["/var/lib/mysql"] ||
      fixture.mounts?.length !== 0 ||
      ports?.length !== 1 ||
      ports[0].HostIp !== "127.0.0.1" ||
      ports[0].HostPort !== url.port
    )
      throw Error("Unowned database refused");
    storage = new S3Client({
      endpoint,
      region: "ru-1",
      forcePathStyle: true,
      maxAttempts: 1,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
      requestHandler: {
        connectionTimeout: 5000,
        requestTimeout: 10000,
        throwOnRequestTimeout: true,
      },
    });
    expect(
      hash(
        (await storage.send(new GetBucketPolicyCommand({ Bucket }))).Policy!,
      ),
    ).toBe(policyHash);
    expect(
      (await storage.send(new GetBucketVersioningCommand({ Bucket }))).Status,
    ).toBeUndefined();
    conn = await mysql.createConnection({
      uri,
      timezone: "Z",
      connectTimeout: 10000,
    });
    expect(await rows("SELECT id FROM users")).toEqual([]);
    expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(41);
    for (const [id, role] of [
      [admin, "admin"],
      [other, "admin"],
      [member, "user"],
    ] as const) {
      const openId = `${prefix}-${id}`;
      await conn.query(
        "INSERT INTO users(id,openId,name,role) VALUES(?,?,?,?)",
        [id, openId, `Synthetic video ${id}`, role],
      );
      tokens.set(
        id,
        await sdk.createSessionToken(openId, { sessionVersion: 0 }),
      );
    }
    await conn.query(
      "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(?,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      [member, prefix],
    );
    workers = await privateAttachmentProcesses();
    browser = await privateFilesBrowser("", {
      /** Связывает отдельный API-процесс с fault-proxy до запуска Next, включая только требуемые video/content возможности. */
      beforeStart: async (origin) => {
        api = await workers.start({
          contentFiles: true,
          privateVideos: true,
          appOrigin: origin,
        });
        proxy = await httpResponseFaultProxy(api.base);
        return proxy.base;
      },
    });
    await browser.context.addInitScript(() =>
      localStorage.setItem("@darcy_install_guide_seen", "1"),
    );
    page = await browser.context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "alert") messages.push(dialog.message());
      await dialog.accept();
    });
    page.on("pageerror", (error) => errors.push(error.message));
  }, 60000);
  /** Возвращает browser-сессию исходному владельцу и очищает alert между сценариями. */
  beforeEach(async () => {
    if (conn) {
      await identity();
      messages.length = 0;
    }
  });
  /** Останавливает стенд и удаляет только свои подтверждённые видео и постеры по metadata, ETag и условному delete. */
  afterAll(async () => {
    await browser?.close();
    await proxy?.close();
    await api?.stop();
    await workers?.close();
    try {
      if (conn && storage) {
        const objects: RowDataPacket[] = [];
        for (const table of [
          "private_attachment_uploads",
          "private_content_files",
        ]) {
          for (const row of await rows(`SELECT * FROM ${table}`)) {
            if (
              row.actorUserId !== admin ||
              (table === "private_attachment_uploads"
                ? row.type !== "video" || !row.filename.startsWith(prefix)
                : row.usage !== "postPhoto" ||
                  row.filename !== "video-poster.jpg") ||
              !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
                row.assetId,
              )
            )
              throw Error("Own video/poster ledger guard refused");
            objects.push(row);
          }
        }
        expect(
          (await storage.send(new GetBucketVersioningCommand({ Bucket })))
            .Status,
        ).toBeUndefined();
        for (const row of objects) {
          const Key = `content/private-v1/${row.assetId}`;
          let meta;
          try {
            meta = await storage.send(new HeadObjectCommand({ Bucket, Key }));
          } catch (e) {
            if (
              row.state === "pending" &&
              (e as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode === 404
            )
              continue;
            throw e;
          }
          if (
            meta.Metadata?.["asset-id"] !== row.assetId ||
            meta.Metadata?.["intent-hash"] !== row.payloadHash ||
            meta.ContentLength !== row.fileSize ||
            meta.ContentType !== row.mimeType ||
            !meta.ETag ||
            (row.etag && meta.ETag !== row.etag)
          )
            throw Error("Own video/poster object guard refused");
          await storage.send(
            new DeleteObjectCommand({ Bucket, Key, IfMatch: meta.ETag }),
          );
          await expect(
            storage.send(new HeadObjectCommand({ Bucket, Key })),
          ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
        }
        expect(
          hash(
            (await storage.send(new GetBucketPolicyCommand({ Bucket })))
              .Policy!,
          ),
        ).toBe(policyHash);
        console.info(
          `[VIDEO-BROWSER] cleaned ${objects.length} own objects; HEAD404; policy unchanged; posts=${(await rows("SELECT id FROM posts")).length}; pageErrors=${errors.length}`,
        );
      }
    } finally {
      await conn?.end();
      storage?.destroy();
    }
  }, 60000);

  for (const mode of ["full", "quick"] as const) {
    /** Проверяет потерю upload/create-ответов, сохранность File в IndexedDB, отсутствие дублей, чтение/Range/воспроизведение и отзыв удалённого вложения. */
    it(`${mode}: lost upload/create responses and document reload preserve video bytes/keys without duplicate posts or PUT`, async () => {
      const filename = name(mode, "create"),
        text = `${prefix}-${mode}-create`,
        beforePuts = puts(),
        beforeRaw = rawUploads().length;
      let form = await open(mode);
      await field(form).fill(text);
      await form.getByRole("button", { name: "Клуб", exact: true }).click();
      await choose(form, filename);
      await ui(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      const original = await storedVideo(mode);
      expect(original.name).toBe(filename);
      expect(Buffer.from(original.bytes)).toEqual(mp4Fixture);
      expect(original.poster).toBe(mode === "full");
      expect(puts()).toBe(beforePuts);
      expect(rawUploads()).toHaveLength(beforeRaw);
      const lost = proxy.arm("binary.privateVideoUpload", "drop");
      await submit(form, mode).click();
      await lost.reached;
      await ui(recover(form)).toBeEnabled();
      expect(await ledger(filename)).toHaveLength(1);
      expect(await rows("SELECT id FROM posts WHERE text=?", [text])).toEqual(
        [],
      );
      form = await open(mode, true);
      expect(await storedVideo(mode)).toEqual(original);
      await recover(form).click();
      await ui(submit(form, mode)).toBeEnabled();
      const expectedPuts = beforePuts + (mode === "full" ? 2 : 1);
      expect(puts()).toBe(expectedPuts);
      expect(rawUploads()).toHaveLength(beforeRaw + 1);
      const lostCreate = proxy.arm("admin.createPost", "drop");
      await submit(form, mode).click();
      await lostCreate.reached;
      await ui(recover(form)).toBeEnabled();
      form = await open(mode, true);
      await recover(form).click();
      await ui(form).toHaveCount(0);
      const saved = await rows("SELECT * FROM posts WHERE text=?", [text]);
      expect(saved).toHaveLength(1);
      const postId = saved[0].id;
      expect(saved[0].target).toBe("club");
      const media = await rows("SELECT * FROM post_media WHERE postId=?", [
        postId,
      ]);
      expect(media).toHaveLength(1);
      expect(await ledger(filename)).toHaveLength(1);
      expect(puts()).toBe(expectedPuts);
      expect(
        await rows(
          "SELECT requestKey FROM post_creation_requests WHERE postId=?",
          [postId],
        ),
      ).toHaveLength(1);
      expect(calls("uploadPhoto")).toEqual([]);
      expect(calls("uploadMedia")).toEqual([]);
      const paths = [
        media[0].url,
        ...(media[0].posterUrl ? [media[0].posterUrl] : []),
      ] as string[];
      await identity(member);
      for (const path of paths) {
        const get = await read(path);
        expect(get.status()).toBe(200);
        expect(get.headers()["cache-control"]).toBe("private, no-store");
        const bytes = await get.body();
        if (path === paths[0]) expect(bytes).toEqual(mp4Fixture);
        expect((await read(path, "HEAD")).headers()["content-length"]).toBe(
          String(bytes.length),
        );
        const range = await read(path, "GET", "bytes=2-5");
        expect(range.status()).toBe(206);
        expect(await range.body()).toEqual(bytes.subarray(2, 6));
      }
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=?",
        [member],
      );
      for (const path of paths) await denied(path);
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE userId=?",
        [member],
      );
      await identity();
      await page.goto(`${browser.origin}/post/${postId}`);
      await page
        .getByRole("button", { name: "Открыть видео", exact: true })
        .first()
        .click();
      const player = page.locator("video").first();
      await ui(player).toHaveAttribute("src", media[0].url);
      await ui
        .poll(() =>
          player.evaluate((node) => (node as HTMLVideoElement).readyState),
        )
        .toBeGreaterThanOrEqual(1);
      await player.evaluate(async (node) => {
        const video = node as HTMLVideoElement;
        const start = video.currentTime;
        try {
          await video.play();
        } catch (error) {
          // Chromium can finish this single-frame fixture before play() settles.
          // Accept only proven completed playback, never a decode/network failure.
          if (
            !(
              error instanceof DOMException &&
              error.name === "AbortError" &&
              start === 0 &&
              video.ended &&
              video.duration > 0 &&
              video.currentTime === video.duration &&
              !video.error
            )
          )
            throw error;
        }
      });
      await ui
        .poll(() =>
          player.evaluate((node) => (node as HTMLVideoElement).currentTime),
        )
        .toBeGreaterThan(0);
      form = await open(mode, false, true);
      await ui(field(form)).toHaveValue(text);
      await form
        .getByRole("button", { name: "Удалить видео 1", exact: true })
        .click();
      await form
        .getByRole("button", { name: "Сохранить", exact: true })
        .first()
        .click();
      await ui(form).toHaveCount(0);
      expect(
        await rows("SELECT id FROM post_media WHERE postId=?", [postId]),
      ).toEqual([]);
      for (const path of paths) await denied(path);
      expect(puts()).toBe(expectedPuts);
      expect(errors).toEqual([]);
    }, 90000);

    for (const stage of ["upload", "status"] as const) {
      /** Меняет аккаунт при позднем upload/status-ответе и проверяет изоляцию исходного File, ключа и квитанции при восстановлении владельцем. */
      it(`${mode}: account switch during ${stage} isolates the original File/key and ignores late native responses`, async () => {
        const filename = name(mode, stage),
          text = `${prefix}-${mode}-${stage}`,
          beforePuts = puts();
        let form = await open(mode);
        await field(form).fill(text);
        await choose(form, filename);
        const upload = proxy.arm(
          "binary.privateVideoUpload",
          stage === "upload" ? "hold" : "drop",
        );
        await submit(form, mode).click();
        await upload.reached;
        let status: ReturnType<typeof proxy.arm> | undefined;
        if (stage === "status") {
          await ui(recover(form)).toBeEnabled();
          status = proxy.arm("admin.privateAttachmentStatus", "hold");
          await recover(form).click();
          await status.reached;
        }
        const original = await storedVideo(mode);
        console.info("[VIDEO-BROWSER] held response", {
          mode,
          stage,
          rawStatuses: rawUploads().map((call) => call.status),
          state: (await ledger(filename))[0]?.state,
        });
        expect((await ledger(filename))[0]).toMatchObject({
          state: "ready",
          postId: null,
        });
        await identity(other);
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await ui(form).toHaveCount(0);
        await page
          .getByRole("button", {
            name: mode === "full" ? "Новый" : "Новый пост",
            exact: true,
          })
          .first()
          .click();
        form = page.getByRole("dialog", { name: "Редактор публикации" });
        await ui(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
          0,
        );
        await ui(field(form)).toHaveValue("");
        await ui(
          form.getByRole("button", { name: "Удалить видео 1", exact: true }),
        ).toHaveCount(0);
        const foreign = await browser.context.request.get(
          `${browser.origin}/api/trpc/admin.privateAttachmentStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: original.key }))}`,
        );
        expect(foreign.status()).toBe(200);
        expect(
          superjson.deserialize((await foreign.json()).result.data),
        ).toEqual({ state: "notRecorded" });
        upload.release();
        status?.release();
        await ui(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        await ui(field(form)).toHaveValue("");
        expect(await rows("SELECT id FROM posts WHERE text=?", [text])).toEqual(
          [],
        );
        await identity();
        form = await open(mode, true);
        await ui(field(form)).toHaveValue(text);
        expect(await storedVideo(mode)).toEqual(original);
        await recover(form).click();
        await ui(submit(form, mode)).toBeEnabled();
        await submit(form, mode).click();
        await ui(form).toHaveCount(0);
        const saved = await rows("SELECT id FROM posts WHERE text=?", [text]);
        expect(saved).toHaveLength(1);
        expect(await ledger(filename)).toHaveLength(1);
        expect(puts()).toBe(beforePuts + (mode === "full" ? 2 : 1));
        expect(
          await rows("SELECT id FROM post_media WHERE postId=?", [saved[0].id]),
        ).toHaveLength(1);
        expect(errors).toEqual([]);
      }, 90000);
    }
  }
});
