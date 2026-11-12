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
import sharp from "sharp";
import superjson from "superjson";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { httpResponseFaultProxy } from "./helpers/http-response-fault-proxy";
import { registerPrivateCommentS3BrowserCases } from "./helpers/private-comment-s3-browser-cases";

const enabled = process.env.PRIVATE_PHOTO_EDITORS_S3_ACCEPTANCE === "true";
const endpoint = "https://s3.twcstorage.ru",
  Bucket = "daryadarcy-s3";
const policyHash =
  "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
/** Вычисляет SHA-256 принятой bucket policy для проверки её неизменности. */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
type Mode = "full" | "quick";
/** Находит текстовое поле настоящего полного либо быстрого редактора публикации. */
const field = (form: Locator) =>
  form.getByPlaceholder("Текст поста… Enter — новый абзац");
/** Выбирает правильное сохранение или публикацию с учётом режима и редактирования. */
const submit = (form: Locator, mode: Mode, editing = false) =>
  form
    .getByRole("button", {
      name: mode === "full" || editing ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();

// No API doubles: faults drop/hold only a completed response from the real Nest API.
/** Опциональная приёмка проверяет реальные фото постов и статей через browser, Next, Nest, отдельную SQL-базу и новые объекты S3. */
describe.skipIf(!enabled)(
  "private photos through both real editors, API and Timeweb S3",
  () => {
    let conn: Connection, storage: S3Client, page: Page, png: Buffer;
    let workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
    let api: Awaited<ReturnType<typeof workers.start>>;
    let browser: Awaited<ReturnType<typeof privateFilesBrowser>>;
    let proxy: Awaited<ReturnType<typeof httpResponseFaultProxy>>;
    const run = randomUUID(),
      prefix = `native-photo-${run}`;
    const tokens = new Map<number, string>(),
      posts = new Map<Mode, number>();
    const messages: string[] = [],
      objects = new Map<string, RowDataPacket>();
    let contentReads = 0;
    let articleId: number;
    /** Читает контрольные SQL-записи собственной одноразовой базы. */
    const rows = async (sql: string, values: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(sql, values))[0];
    /** Считает реальные PUT API-процесса для обнаружения дублирующих загрузок. */
    const puts = () =>
      api.commands.filter((name) => name === "PutObjectCommand").length;
    /** Отбирает завершённые вызовы конкретной admin-процедуры из fault-proxy. */
    const calls = (name: string) =>
      proxy.calls.filter((call) => call.pathname === `/api/trpc/admin.${name}`);
    /** Устанавливает cookie выбранного синтетического владельца, другого администратора или участницы. */
    async function identity(id = 98920) {
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
    /** Открывает настоящий редактор и ждёт завершения чтения локального журнала. */
    async function open(mode: Mode, editing = false) {
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
      await ui(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
        0,
      );
      return form;
    }
    /** Выбирает или заменяет синтетический PNG через filechooser и проверяет настоящую blob-картинку по naturalWidth. */
    async function choose(form: Locator, name: string, replace = false) {
      const chooser = page.waitForEvent("filechooser");
      await form
        .getByRole("button", {
          name: replace ? "Заменить фото 1" : "Выбрать из галереи",
          exact: true,
        })
        .click();
      await (
        await chooser
      ).setFiles({
        name: `${prefix}-${name}.png`,
        mimeType: "image/png",
        buffer: png,
      });
      await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
      await ui
        .poll(() =>
          form
            .locator('img[src^="blob:"]')
            .first()
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBe(4);
    }
    /** Заново открывает документ и явно восстанавливает черновик с локальными фото из журнала. */
    async function reload(mode: Mode, editing = false) {
      // A real document navigation, not remounting a fixture or in-memory snapshot.
      const form = await open(mode, editing);
      await form
        .getByRole("button", { name: "Восстановить черновик", exact: true })
        .click();
      await ui(form.locator('img[src^="blob:"]').first()).toBeVisible();
      return form;
    }
    /** Запускает явную проверку сохранения после неопределённого ответа. */
    const recover = (form: Locator) =>
      form
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
    /** Выполняет GET, HEAD либо Range приватного URL через browser request с текущей cookie. */
    const read = (url: string, method = "GET", range?: string) =>
      browser.context.request.fetch(`${browser.origin}${url}`, {
        method,
        headers: range ? { range } : {},
        timeout: 20000,
      });
    /** Читает квитанцию конкретного синтетического фото по префиксу имени. */
    const ledger = (name: string) =>
      rows("SELECT * FROM private_content_files WHERE filename LIKE ?", [
        `${prefix}-${name}.%`,
      ]);
    /** Нормализует JSON-представление photos, которое MySQL может вернуть строкой либо массивом. */
    const photos = (row: RowDataPacket): string[] =>
      typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos;
    /** Проверяет одинаковый закрытый отказ GET, HEAD и Range без запросов S3. */
    async function denied(url: string) {
      const before = api.commands.length;
      for (const [method, range] of [
        ["GET", undefined],
        ["HEAD", undefined],
        ["GET", "bytes=0-3"],
      ] as const) {
        const response = await read(url, method, range);
        expect(response.status()).toBe(404);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
      }
      expect(api.commands.length).toBe(before);
    }
    /** Сверяет metadata, MIME, размер и ETag нового объекта с собственной квитанцией. */
    async function inspectObject(row: RowDataPacket) {
      const Key = `content/private-v1/${row.assetId}`;
      const meta = await storage.send(new HeadObjectCommand({ Bucket, Key }));
      if (
        meta.Metadata?.["asset-id"] !== row.assetId ||
        meta.Metadata?.["intent-hash"] !== row.payloadHash ||
        meta.ContentLength !== row.fileSize ||
        meta.ContentType !== row.mimeType ||
        !meta.ETag ||
        (row.etag && meta.ETag !== row.etag)
      )
        throw new Error("Own content metadata/ETag guard refused");
      return { Key, meta };
    }
    /** Проверяет место, явные флаги, владение пустой tmpfs-базой и политику перед созданием синтетических ролей и browser-стенда. */
    beforeAll(async () => {
      const disk = await statfs(tmpdir());
      if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
        throw new Error(
          "Native photo acceptance requires 2 GiB free; no API/S3 writes started",
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
        throw new Error("Explicit owned acceptance inputs required");
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
        bindings = fixture.ports?.["3306/tcp"];
      if (
        fixture.id !== id ||
        !/^daryadarcy-fresh-editors-[a-z0-9-]+$/.test(fixture.owner) ||
        fixture.name !== `/${fixture.owner}` ||
        !fixture.tmpfs?.["/var/lib/mysql"] ||
        fixture.mounts?.length !== 0 ||
        bindings?.length !== 1 ||
        bindings[0].HostIp !== "127.0.0.1" ||
        bindings[0].HostPort !== url.port
      )
        throw new Error("Unowned database refused");
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
      expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(
        39,
      );
      for (const [id, role] of [
        [98920, "admin"],
        [98921, "admin"],
        [98922, "user"],
      ] as const) {
        const openId = `${prefix}-${id}`;
        await conn.query(
          "INSERT INTO users(id,openId,name,role) VALUES(?,?,?,?)",
          [id, openId, `Synthetic photo editor ${id}`, role],
        );
        tokens.set(
          id,
          await sdk.createSessionToken(openId, { sessionVersion: 0 }),
        );
      }
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98922,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [prefix],
      );
      png = await sharp({
        create: {
          width: 4,
          height: 4,
          channels: 4,
          background: { r: 25, g: 50, b: 75, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer();
      workers = await privateAttachmentProcesses();
      browser = await privateFilesBrowser("", {
        /** Поднимает отдельный API и fault-proxy до запуска Next с правильным origin. */
        beforeStart: async (origin) => {
          api = await workers.start({ contentFiles: true, appOrigin: origin });
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
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname.startsWith(
            "/api/media/content-files/",
          )
        )
          contentReads++;
      });
    }, 60000);
    /** Возвращает срок собственной подписки, сессию владельца и пустой список alert перед сценарием. */
    beforeEach(async () => {
      if (!conn) return;
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId=?",
        [prefix],
      );
      await identity();
      messages.length = 0;
    });
    /** Останавливает стенд и удаляет только новые собственные объекты после сверки назначения, metadata и условного ETag-delete. */
    afterAll(async () => {
      await browser?.close();
      await proxy?.close();
      await api?.stop();
      await workers?.close();
      try {
        if (conn && storage) {
          for (const row of await rows("SELECT * FROM private_content_files")) {
            if (
              row.actorUserId !== 98920 ||
              ![
                "postPhoto",
                "articlePhoto",
                "articleDocument",
                "commentPhoto",
              ].includes(row.usage) ||
              !row.filename.startsWith(`${prefix}-`) ||
              (row.usage === "articleDocument"
                ? !row.mimeType.startsWith("text/plain")
                : row.mimeType !== "image/webp") ||
              !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
                row.assetId,
              )
            )
              throw new Error("Own photo ledger guard refused");
            objects.set(row.assetId, row);
          }
          expect(
            (await storage.send(new GetBucketVersioningCommand({ Bucket })))
              .Status,
          ).toBeUndefined();
          for (const row of objects.values()) {
            let object;
            try {
              object = await inspectObject(row);
            } catch (error) {
              if (
                (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                  ?.httpStatusCode === 404 &&
                row.state === "pending"
              )
                continue;
              throw error;
            }
            await storage.send(
              new DeleteObjectCommand({
                Bucket,
                Key: object.Key,
                IfMatch: object.meta.ETag,
              }),
            );
            await expect(
              storage.send(new HeadObjectCommand({ Bucket, Key: object.Key })),
            ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
          }
          expect(
            hash(
              (await storage.send(new GetBucketPolicyCommand({ Bucket })))
                .Policy!,
            ),
          ).toBe(policyHash);
          console.info(
            `[PHOTO-EDITORS] cleaned ${objects.size} own objects; HEAD404; policy unchanged; posts=${(await rows("SELECT id FROM posts")).length}; intents=${(await rows("SELECT requestKey FROM post_creation_requests")).length}; articles=${(await rows("SELECT id FROM articles")).length}`,
          );
        }
      } finally {
        await conn?.end();
        storage?.destroy();
      }
    }, 60000);

    registerPrivateCommentS3BrowserCases(() => ({
      page,
      context: browser.context,
      origin: browser.origin,
      prefix,
      png,
      proxy,
      rows,
      /** Передаёт SQL-запись отдельной базы общим сценариям фотографий комментариев без подмены сервиса. */
      execute: (sql, args) => conn.query(sql, args),
      identity,
      puts,
      read,
      denied,
    }));
    /** Открывает создание, редактирование либо восстановление статьи через настоящую административную форму. */
    async function openArticle(restore = false, editing = false) {
      await page.goto(`${browser.origin}/admin`);
      await page.getByRole("button", { name: "Статьи", exact: true }).click();
      await page
        .getByRole("button", {
          name: restore
            ? editing
              ? "Восстановить изменение статьи"
              : "Восстановить создание статьи"
            : editing
              ? "Править"
              : "Написать статью",
          exact: true,
        })
        .click();
    }
    /** Передаёт синтетическое фото или документ в выбранный блок статьи через настоящий filechooser. */
    async function chooseArticle(
      button: string,
      name: string,
      bytes = png,
      mimeType = "image/png",
    ) {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: button, exact: true }).click(),
      ]);
      await chooser.setFiles({
        name: `${prefix}-${name}`,
        mimeType,
        buffer: bytes,
      });
    }
    /** Проверяет смешанные фото, прозрачный PNG, карусель и документ с потерей upload/create-ответов, восстановлением и точной закрытой выдачей. */
    it("article: mixed private photo/PNG/carousel/document recover upload/create response loss with actual SQL and S3", async () => {
      const beforePuts = puts(),
        beforeUploads = calls("uploadPrivateContentFile").length,
        beforeCreates = calls("createArticle").length;
      await openArticle();
      await page
        .getByPlaceholder("Что посмотреть осенью...")
        .fill(`${prefix}-article`);
      for (const [block, button, filename] of [
        ["Фото", "Выбрать фото", "article-photo.png"],
        ["PNG", "Выбрать PNG без фона", "article-alpha.png"],
        ["Карусель", "Выбрать фото для карусели", "article-slide.png"],
      ]) {
        await page
          .getByRole("button", { name: block, exact: true })
          .first()
          .click();
        await chooseArticle(button, filename);
      }
      await page
        .getByRole("button", { name: "Ссылка", exact: true })
        .first()
        .click();
      await chooseArticle(
        "Загрузить файл",
        "article-doc.txt",
        Buffer.from("private article document"),
        "text/plain",
      );
      expect(puts()).toBe(beforePuts);
      expect(calls("uploadPhoto")).toEqual([]);
      const lostUpload = proxy.arm("admin.uploadPrivateContentFile", "drop");
      await page
        .getByRole("button", { name: "Опубликовать", exact: true })
        .click();
      await lostUpload.reached;
      await ui(
        page.getByRole("button", { name: "Проверить сохранение", exact: true }),
      ).toBeEnabled();
      expect(calls("uploadPrivateContentFile").at(-1)?.status).toBe(200);
      expect(puts()).toBe(beforePuts + 1);
      expect(await rows("SELECT id FROM articles")).toEqual([]);
      await openArticle(true);
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(3);
      await page
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
      // Three remaining real S3 uploads are sequential and individually bounded
      // by the transport. Wait for the operation, not Playwright's 5s text default.
      try {
        await ui(
          page.getByRole("button", {
            name: "Повторить сохранение",
            exact: true,
          }),
        ).toBeEnabled({ timeout: 45000 });
        await ui(
          page.getByRole("alert").filter({ hasText: "Файлы подтверждены" }),
        ).toBeVisible();
      } catch (error) {
        console.info("[ARTICLE-S3] recovery diagnostic", {
          calls: proxy.calls.slice(-12),
          receipts: await rows("SELECT state FROM private_content_files"),
          text: (await page.locator("body").innerText()).slice(-3500),
        });
        throw error;
      }
      expect(puts()).toBe(beforePuts + 4);
      expect(calls("uploadPrivateContentFile")).toHaveLength(beforeUploads + 4);
      const lostCreate = proxy.arm("admin.createArticle", "drop");
      await page
        .getByRole("button", { name: "Повторить сохранение", exact: true })
        .click();
      await lostCreate.reached;
      await ui(
        page.getByRole("alert").filter({ hasText: "Не удалось подтвердить" }),
      ).toBeVisible();
      expect(calls("createArticle").at(-1)?.status).toBe(200);
      await openArticle(true);
      await page
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
      await ui(page.getByPlaceholder("Что посмотреть осенью...")).toHaveCount(
        0,
      );
      const saved = await rows("SELECT * FROM articles WHERE title=?", [
        `${prefix}-article`,
      ]);
      expect(saved).toHaveLength(1);
      articleId = saved[0].id;
      expect(
        await rows(
          "SELECT requestKey FROM article_creation_requests WHERE articleId=?",
          [articleId],
        ),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM posts WHERE source=?", [
          `article:${articleId}`,
        ]),
      ).toHaveLength(1);
      const files = await rows(
        "SELECT * FROM private_content_files WHERE parentKind='article' AND parentId=?",
        [articleId],
      );
      expect(files).toHaveLength(4);
      expect(calls("createArticle")).toHaveLength(beforeCreates + 1);
      expect(puts()).toBe(beforePuts + 4);
      const sections =
        typeof saved[0].sections === "string"
          ? JSON.parse(saved[0].sections)
          : saved[0].sections;
      expect(
        sections.flatMap(
          (block: { url?: string; urls?: string[] }) =>
            block.urls ?? (block.url ? [block.url] : []),
        ),
      ).toHaveLength(4);
      await identity(98922);
      for (const file of files) {
        const url = `/api/media/content-files/${file.assetId}`,
          response = await read(url);
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        const bytes = await response.body();
        if (file.usage === "articleDocument")
          expect(bytes.toString()).toBe("private article document");
        else
          expect(await sharp(bytes).metadata()).toMatchObject({
            format: "webp",
            width: 4,
            height: 4,
            hasAlpha: true,
          });
        expect((await read(url, "HEAD")).headers()["content-length"]).toBe(
          String(bytes.length),
        );
        const range = await read(url, "GET", "bytes=0-3");
        expect(range.status()).toBe(206);
        expect(await range.body()).toEqual(bytes.subarray(0, 4));
        await inspectObject(file);
        const direct = await fetch(
          `${endpoint}/${Bucket}/content/private-v1/${file.assetId}`,
          {
            method: "HEAD",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          },
        );
        expect(direct.status).toBe(403);
        await direct.body?.cancel();
      }
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId=?",
        [prefix],
      );
      for (const file of files)
        await denied(`/api/media/content-files/${file.assetId}`);
    }, 180000);
    /** Проверяет сохранность прежних привязок статьи и отсутствие слепого повторного update после потери успешного ответа. */
    it("article: editing retains previous file bindings and never replays a lost update response", async () => {
      expect(articleId).toBeTypeOf("number");
      const previous = await rows(
        "SELECT assetId FROM private_content_files WHERE parentId=?",
        [articleId],
      );
      const beforePuts = puts(),
        beforeUpdates = calls("updateArticle").length;
      await openArticle(false, true);
      await page
        .getByRole("button", { name: "Фото", exact: true })
        .first()
        .click();
      await chooseArticle("Выбрать фото", "article-edit.png");
      const lostUpload = proxy.arm("admin.uploadPrivateContentFile", "drop");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await lostUpload.reached;
      await ui(
        page.getByRole("button", { name: "Проверить сохранение", exact: true }),
      ).toBeEnabled();
      await openArticle(true, true);
      const lostUpdate = proxy.arm("admin.updateArticle", "drop");
      await page
        .getByRole("button", { name: "Повторить сохранение", exact: true })
        .click();
      await lostUpdate.reached;
      await ui(
        page.getByRole("button", {
          name: "Проверил список — удалить локальную копию",
          exact: true,
        }),
      ).toBeVisible();
      expect(calls("updateArticle").at(-1)?.status).toBe(200);
      expect(puts()).toBe(beforePuts + 1);
      await openArticle(true, true);
      await ui(
        page.getByRole("button", { name: "Повторить сохранение", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
      await ui(
        page
          .getByRole("alert")
          .filter({ hasText: "повторная запись не выполнялась" }),
      ).toBeVisible();
      expect(calls("updateArticle")).toHaveLength(beforeUpdates + 1);
      const after = await rows(
        "SELECT assetId FROM private_content_files WHERE parentKind='article' AND parentId=?",
        [articleId],
      );
      expect(after).toHaveLength(5);
      for (const file of previous) expect(after).toContainEqual(file);
      expect(
        await rows("SELECT id FROM articles WHERE id=?", [articleId]),
      ).toHaveLength(1);
      await page
        .getByRole("button", {
          name: "Проверил список — удалить локальную копию",
          exact: true,
        })
        .click();
      await ui(page.getByPlaceholder("Что посмотреть осенью...")).toHaveCount(
        0,
      );
    }, 120000);

    for (const mode of ["full", "quick"] as const) {
      /** Проверяет оба редактора при потере upload/create-ответов и перезагрузке с одним WebP-объектом и постом, сохранённой прозрачностью и удалённым EXIF. */
      it(`${mode}: lost upload/create responses recover real photos across reload without duplicate rows or PUT`, async () => {
        const name = `${mode}-create`,
          text = `${prefix}-${name}`;
        const beforePuts = puts(),
          beforeCreates = calls("createPost").length,
          beforeUploads = calls("uploadPrivateContentFile").length;
        let form = await open(mode);
        await field(form).fill(text);
        await form.getByRole("button", { name: "Клуб", exact: true }).click();
        const beforeReads = contentReads;
        await choose(form, name);
        expect(puts()).toBe(beforePuts);
        expect(calls("uploadPrivateContentFile")).toHaveLength(beforeUploads);
        const lostUpload = proxy.arm("admin.uploadPrivateContentFile", "drop");
        await submit(form, mode).click();
        await lostUpload.reached;
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toBeVisible();
        expect(calls("uploadPrivateContentFile").at(-1)?.status).toBe(200);
        const recorded = await ledger(name);
        expect(recorded).toHaveLength(1);
        const asset = recorded[0],
          url = `/api/media/content-files/${asset.assetId}`;
        expect(asset).toMatchObject({
          state: "ready",
          parentId: null,
          usage: "postPhoto",
          mimeType: "image/webp",
        });
        expect(await rows("SELECT id FROM posts WHERE text=?", [text])).toEqual(
          [],
        );
        await denied(url);
        form = await reload(mode);
        await recover(form);
        await ui(submit(form, mode)).toBeEnabled();
        expect(contentReads).toBe(beforeReads); // No unbound server preview; only local blob.
        expect(puts()).toBe(beforePuts + 1);
        expect(calls("uploadPrivateContentFile")).toHaveLength(
          beforeUploads + 1,
        );
        const lostCreate = proxy.arm("admin.createPost", "drop");
        await submit(form, mode).click();
        await lostCreate.reached;
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toBeVisible();
        expect(calls("createPost").at(-1)?.status).toBe(200);
        form = await reload(mode);
        await recover(form);
        await ui(form).toHaveCount(0);
        const saved = await rows("SELECT * FROM posts WHERE text=?", [text]);
        expect(saved).toHaveLength(1);
        expect(photos(saved[0])).toEqual([url]);
        expect(saved[0].target).toBe("club");
        posts.set(mode, saved[0].id);
        expect(
          await rows(
            "SELECT requestKey FROM post_creation_requests WHERE postId=?",
            [saved[0].id],
          ),
        ).toHaveLength(1);
        expect(await ledger(name)).toHaveLength(1);
        expect((await ledger(name))[0]).toMatchObject({
          parentKind: "post",
          parentId: saved[0].id,
        });
        expect(calls("createPost")).toHaveLength(beforeCreates + 2);
        expect(puts()).toBe(beforePuts + 1);
        expect(calls("uploadPhoto")).toEqual([]);
        await identity(98922);
        const response = await read(url);
        expect(response.status()).toBe(200);
        expect(response.headers()).toMatchObject({
          "content-type": "image/webp",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        });
        const bytes = await response.body();
        expect(await sharp(bytes).metadata()).toMatchObject({
          format: "webp",
          width: 4,
          height: 4,
          hasAlpha: true,
        });
        expect((await sharp(bytes).metadata()).exif).toBeUndefined();
        const range = await read(url, "GET", "bytes=0-3");
        expect(range.status()).toBe(206);
        expect(await range.body()).toEqual(bytes.subarray(0, 4));
        expect((await read(url, "HEAD")).headers()["content-length"]).toBe(
          String(bytes.length),
        );
        await conn.query(
          "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId=?",
          [prefix],
        );
        await denied(url);
        await browser.context.clearCookies();
        await denied(url);
        await inspectObject(asset);
        const direct = await fetch(
          `${endpoint}/${Bucket}/content/private-v1/${asset.assetId}`,
          {
            method: "HEAD",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          },
        );
        expect(direct.status).toBe(403);
        await direct.body?.cancel();
      }, 180000);

      /** Проверяет одно новое фото при редактировании и отсутствие слепого повторного update, сохраняя локальное доказательство до явного удаления. */
      it(`${mode}: editing uses one new photo and never replays an unknown update`, async () => {
        const id = posts.get(mode)!;
        expect(id).toBeTypeOf("number");
        const original = photos(
          (await rows("SELECT photos FROM posts WHERE id=?", [id]))[0],
        );
        const beforePuts = puts(),
          beforeUpdates = calls("updatePost").length,
          name = `${mode}-edit`;
        let form = await open(mode, true);
        expect(await field(form).inputValue()).toBe(`${prefix}-${mode}-create`);
        await choose(form, name, mode === "quick");
        const lostUpload = proxy.arm("admin.uploadPrivateContentFile", "drop");
        await submit(form, mode, true).click();
        await lostUpload.reached;
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toBeVisible();
        form = await reload(mode, true);
        await recover(form);
        await ui(submit(form, mode, true)).toBeEnabled();
        const lostUpdate = proxy.arm("admin.updatePost", "drop");
        await submit(form, mode, true).click();
        await lostUpdate.reached;
        await ui(
          form.getByRole("button", {
            name: "Удалить локальную копию",
            exact: true,
          }),
        ).toBeVisible();
        const asset = (await ledger(name))[0],
          url = `/api/media/content-files/${asset.assetId}`;
        const expected = mode === "full" ? [...original, url] : [url];
        expect(
          photos((await rows("SELECT photos FROM posts WHERE id=?", [id]))[0]),
        ).toEqual(expected);
        expect(asset).toMatchObject({
          state: "ready",
          parentKind: "post",
          parentId: id,
        });
        expect(puts()).toBe(beforePuts + 1);
        form = await reload(mode, true);
        await ui(submit(form, mode, true)).toBeDisabled();
        expect(calls("updatePost")).toHaveLength(beforeUpdates + 1);
        await ui(
          form.getByRole("button", {
            name: "Проверить сохранение",
            exact: true,
          }),
        ).toHaveCount(0);
        expect(
          photos((await rows("SELECT photos FROM posts WHERE id=?", [id]))[0]),
        ).toEqual(expected);
        await form
          .getByRole("button", {
            name: "Удалить локальную копию",
            exact: true,
          })
          .click();
        await ui(form).toHaveCount(0);
      }, 120000);

      for (const stage of ["upload", "status"] as const) {
        /** Меняет аккаунт при позднем upload/status-ответе и проверяет отзыв blob URL, изоляцию ключа и восстановление только исходным владельцем. */
        it(`${mode}: account switch during ${stage} rejects a late receipt and restores only the original owner's photo`, async () => {
          const name = `${mode}-${stage}`,
            text = `${prefix}-${name}`,
            beforePuts = puts(),
            beforeUploads = calls("uploadPrivateContentFile").length;
          let form = await open(mode);
          await field(form).fill(text);
          await choose(form, name);
          const upload = proxy.arm(
            "admin.uploadPrivateContentFile",
            stage === "upload" ? "hold" : "drop",
          );
          let status: ReturnType<typeof proxy.arm> | undefined;
          try {
            await submit(form, mode).click();
            await upload.reached;
            if (stage === "status") {
              await ui(
                form.getByRole("button", {
                  name: "Проверить сохранение",
                  exact: true,
                }),
              ).toBeVisible();
              status = proxy.arm("admin.privateContentFileStatus", "hold");
              await recover(form);
              await status.reached;
            }
            const recorded = await ledger(name);
            expect(recorded).toHaveLength(1);
            expect(recorded[0]).toMatchObject({
              state: "ready",
              parentId: null,
            });
            const url = `/api/media/content-files/${recorded[0].assetId}`;
            await denied(url);
            const preview = await form
              .locator('img[src^="blob:"]')
              .first()
              .getAttribute("src");
            await identity(98921);
            await page.evaluate(() =>
              window.dispatchEvent(new Event("online")),
            );
            await ui(form).toHaveCount(0);
            expect(
              await page.evaluate(async (url) => {
                try {
                  await fetch(url!);
                  return "readable";
                } catch {
                  return "revoked";
                }
              }, preview),
            ).toBe("revoked");
            await page
              .getByRole("button", {
                name: mode === "full" ? "Новый" : "Новый пост",
                exact: true,
              })
              .first()
              .click();
            form = page.getByRole("dialog", { name: "Редактор публикации" });
            await ui(
              form.getByText("Черновик сохранён на этом устройстве", {
                exact: true,
              }),
            ).toBeVisible();
            await ui(field(form)).toHaveValue("");
            await ui(form.locator('img[src^="blob:"]')).toHaveCount(0);
            const key = await page.evaluate(
              (slot) =>
                new Promise<string>((resolve, reject) => {
                  const opening = indexedDB.open("darcy-post-drafts", 1);
                  opening.onerror = () => reject(opening.error);
                  opening.onsuccess = () => {
                    const db = opening.result,
                      tx = db.transaction("drafts", "readonly"),
                      get = tx.objectStore("drafts").get(`98920:${slot}`);
                    get.onsuccess = () =>
                      resolve(get.result.save.privatePhotos[0].key);
                    tx.oncomplete = () => db.close();
                  };
                }),
              mode === "full" ? "full:new" : "quick:new:feed",
            );
            const foreign = await browser.context.request.get(
              `${browser.origin}/api/trpc/admin.privateContentFileStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: key }))}`,
            );
            expect(foreign.status()).toBe(200);
            expect(
              superjson.deserialize((await foreign.json()).result.data),
            ).toEqual({ state: "notRecorded" });
            status?.release();
            upload.release();
            await ui(field(form)).toHaveValue("");
            expect(
              await rows("SELECT id FROM posts WHERE text=?", [text]),
            ).toEqual([]);
            await identity();
            form = await reload(mode);
            await ui(field(form)).toHaveValue(text);
            await recover(form);
            await ui(submit(form, mode)).toBeEnabled();
            expect(puts()).toBe(beforePuts + 1);
            expect(calls("uploadPrivateContentFile")).toHaveLength(
              beforeUploads + 1,
            );
            await submit(form, mode).click();
            await ui(form).toHaveCount(0);
            const saved = await rows("SELECT * FROM posts WHERE text=?", [
              text,
            ]);
            expect(saved).toHaveLength(1);
            expect(photos(saved[0])).toEqual([url]);
            expect(await ledger(name)).toHaveLength(1);
            expect((await ledger(name))[0]).toMatchObject({
              parentKind: "post",
              parentId: saved[0].id,
            });
          } finally {
            status?.release();
            upload.release();
          }
        }, 120000);
      }
    }
  },
);
