import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import type { Page, Locator } from "@playwright/test";
import superjson from "superjson";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { privateFilesBrowser } from "./helpers/private-files-browser";
import { httpResponseFaultProxy } from "./helpers/http-response-fault-proxy";
import { wavFixture } from "./helpers/media-fixtures";

const enabled = process.env.PRIVATE_EDITORS_S3_ACCEPTANCE === "true";
const endpoint = "https://s3.twcstorage.ru",
  Bucket = "daryadarcy-s3";
const policyHash =
  "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
/** Вычисляет SHA-256 принятой bucket policy, которую сценарий вправе проверить, но не менять. */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
type Mode = "full" | "quick";
/** Находит текстовое поле настоящего редактора по пользовательскому placeholder. */
const field = (form: Locator) =>
  form.getByPlaceholder("Текст поста… Enter — новый абзац");
/** Выбирает кнопку сохранения полного редактора либо публикации быстрого в зависимости от режима и редактирования. */
const submit = (form: Locator, mode: Mode, editing = false) =>
  form
    .getByRole("button", {
      name: mode === "full" || editing ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();

// Explicit opt-in: real browser -> unchanged Next rewrite -> real API -> SQL/S3.
// The only response interference is a transport drop/hold AFTER upstream completion.
/** Опциональная приёмка проверяет оба настоящих редактора через Next, API, отдельную SQL-базу и новые объекты Timeweb S3. */
describe.skipIf(!enabled)(
  "private attachments through both real editors, API and Timeweb S3",
  () => {
    let conn: Connection, storage: S3Client;
    let workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
    let api: Awaited<ReturnType<typeof workers.start>>;
    let browser: Awaited<ReturnType<typeof privateFilesBrowser>>;
    let proxy: Awaited<ReturnType<typeof httpResponseFaultProxy>>;
    let page: Page;
    const run = randomUUID(),
      prefix = `native-editor-${run}`;
    const tokens = new Map<number, string>();
    const posts = new Map<Mode, number>();
    const objects = new Map<string, RowDataPacket>();
    const messages: string[] = [];
    const pageErrors: string[] = [];
    /** Читает контрольные записи отдельной базы по тексту и имени собственной фикстуры. */
    const rows = async (sql: string, values: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(sql, values))[0];
    /** Считает выполненные настоящим API PUT для проверки отсутствия дублирующих загрузок. */
    const puts = () =>
      api.commands.filter((name) => name === "PutObjectCommand").length;
    /** Отбирает завершённые запросы конкретной admin-процедуры из fault-proxy. */
    const calls = (name: string) =>
      proxy.calls.filter((call) => call.pathname === `/api/trpc/admin.${name}`);
    /** Устанавливает host-scoped HttpOnly-cookie выбранного синтетического администратора или участника. */
    async function identity(id = 98910) {
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
    /** Открывает нужный настоящий редактор, дожидается проверки локального журнала и выводит ограниченную диагностику при отказе открытия. */
    async function open(mode: Mode, editing = false) {
      const response = await page.goto(
        `${browser.origin}${mode === "full" ? "/admin" : editing ? "/club" : "/feed"}`,
        { waitUntil: "load" },
      );
      expect(response?.status()).toBe(200);
      const install = page.getByRole("dialog", {
        name: "Установка приложения",
      });
      if (await install.isVisible())
        await install
          .getByRole("button", { name: "Закрыть", exact: true })
          .click();
      if (editing && mode === "quick")
        await page
          .getByRole("button", { name: "Действия с постом", exact: true })
          .first()
          .click();
      const opener = page
        .getByRole("button", {
          name: editing
            ? "Редактировать пост"
            : mode === "full"
              ? "Новый"
              : "Новый пост",
          exact: true,
        })
        .first();
      try {
        await opener.click();
      } catch (error) {
        console.info("[PRIVATE-EDITORS] page diagnostic", {
          url: page.url(),
          text: (await page.locator("body").innerText()).slice(0, 5000),
          calls: proxy.calls.slice(-12),
          pageErrors: pageErrors.slice(-3),
        });
        throw error;
      }
      const form = page.getByRole("dialog", { name: "Редактор публикации" });
      await expect.poll(() => form.isVisible()).toBe(true);
      await expect
        .poll(() => form.getByText("Проверяем сохранённый черновик…").count())
        .toBe(0);
      return form;
    }
    /** Выбирает синтетический аудиофайл или документ настоящим filechooser и ждёт появления вложения в форме. */
    async function choose(
      form: Locator,
      kind: "Аудио" | "Документ",
      name: string,
      bytes: Buffer,
    ) {
      const chooser = page.waitForEvent("filechooser");
      await form.getByRole("button", { name: kind, exact: true }).click();
      await (
        await chooser
      ).setFiles({
        name,
        mimeType: kind === "Аудио" ? "audio/wav" : "text/plain",
        buffer: bytes,
      });
      await expect
        .poll(() => form.getByText(name, { exact: true }).isVisible())
        .toBe(true);
    }
    /** Нажимает явную проверку сохранения после неопределённого результата операции. */
    async function recover(form: Locator) {
      await form
        .getByRole("button", { name: "Проверить сохранение", exact: true })
        .click();
    }
    /** Перезагружает документ, открывает редактор и явно восстанавливает его локальный черновик. */
    async function reload(form: Locator, mode: Mode, editing = false) {
      await page.reload({ waitUntil: "domcontentloaded" });
      form = await open(mode, editing);
      await form
        .getByRole("button", { name: "Восстановить черновик", exact: true })
        .click();
      return form;
    }
    /** Читает файл через настоящий browser request с cookie и опциональным Range. */
    async function read(url: string, method = "GET", range?: string) {
      return browser.context.request.fetch(`${browser.origin}${url}`, {
        method,
        headers: range ? { range } : {},
      });
    }
    /** Проверяет место, владение пустым tmpfs-контейнером, политику и отсутствие versioning до создания синтетических ролей и browser-стенда. */
    beforeAll(async () => {
      const disk = await statfs(tmpdir());
      if (disk.bavail * disk.bsize < 2 * 1024 ** 3)
        throw new Error(
          "Native editor acceptance needs at least 2 GiB free for the isolated Next build; no API/S3 writes started",
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
      const { stdout } = await promisify(execFile)("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
      ]);
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
      conn = await mysql.createConnection({ uri, timezone: "Z" });
      expect(await rows("SELECT id FROM users")).toEqual([]);
      expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(
        39,
      );
      for (const [id, role] of [
        [98910, "admin"],
        [98911, "admin"],
        [98912, "user"],
      ] as const) {
        const openId = `${prefix}-${id}`;
        await conn.query(
          "INSERT INTO users(id,openId,name,role) VALUES(?,?,?,?)",
          [id, openId, `Synthetic editor ${id}`, role],
        );
        tokens.set(
          id,
          await sdk.createSessionToken(openId, { sessionVersion: 0 }),
        );
      }
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98912,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [`editor-paid-${run}`],
      );
      workers = await privateAttachmentProcesses();
      browser = await privateFilesBrowser("", {
        /** Перед запуском фронта создаёт отдельный API-процесс и fault-proxy, возвращая его адрес для штатного Next rewrite. */
        beforeStart: async (origin) => {
          api = await workers.start({ appOrigin: origin });
          proxy = await httpResponseFaultProxy(api.base);
          return proxy.base;
        },
      });
      await browser.context.addInitScript(() => {
        localStorage.setItem("@darcy_install_guide_seen", "1");
      });
      page = await browser.context.newPage();
      // Cold dev chunks include the existing static image catalog; do not
      // confuse delayed hydration with a failed authenticated API operation.
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      page.on("pageerror", (error) =>
        pageErrors.push(error.message.slice(0, 1000)),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          pageErrors.push(message.text().slice(0, 1000));
      });
      page.on("dialog", async (dialog) => {
        if (dialog.type() === "alert") messages.push(dialog.message());
        await dialog.accept();
      });
    }, 60000);
    /** Возвращает срок собственной подписки и сессию администратора, очищая захваченные alert. */
    beforeEach(async () => {
      if (!conn) return;
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId=?",
        [`editor-paid-${run}`],
      );
      await identity();
      messages.length = 0;
    });
    /** Останавливает browser/API/proxy и удаляет только свои подтверждённые новые S3-объекты после проверки metadata и ETag. */
    afterAll(async () => {
      await browser?.close();
      await proxy?.close();
      await api?.stop();
      await workers?.close();
      try {
        if (conn && storage) {
          for (const row of await rows(
            "SELECT * FROM private_attachment_uploads",
          )) {
            if (
              row.actorUserId !== 98910 ||
              !row.filename.startsWith(prefix) ||
              !/^[a-f0-9-]{36}$/.test(row.assetId)
            )
              throw new Error("Own S3 fixture guard refused");
            objects.set(row.assetId, row);
          }
          expect(
            (await storage.send(new GetBucketVersioningCommand({ Bucket })))
              .Status,
          ).toBeUndefined();
          for (const row of objects.values()) {
            const Key = `feed/${row.type === "audio" ? "audio" : "documents"}/private-v1/${row.assetId}`;
            let meta;
            try {
              meta = await storage.send(new HeadObjectCommand({ Bucket, Key }));
            } catch (error) {
              if (
                (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                  ?.httpStatusCode === 404 &&
                row.state === "pending"
              )
                continue;
              throw error;
            }
            if (
              meta.Metadata?.["asset-id"] !== row.assetId ||
              meta.Metadata?.["intent-hash"] !== row.payloadHash ||
              meta.ContentLength !== row.fileSize ||
              !meta.ETag ||
              (row.etag && row.etag !== meta.ETag)
            )
              throw new Error("Own object metadata/ETag guard refused");
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
            `[PRIVATE-EDITORS] cleaned ${objects.size} own objects; HEAD404; policy unchanged`,
          );
        }
      } finally {
        await conn?.end();
        storage?.destroy();
      }
    }, 60000);

    for (const mode of ["full", "quick"] as const) {
      /** Для обоих редакторов теряет upload и create-ответы после upstream-коммита, восстанавливает журнал и проверяет точные байты, доступ и отсутствие дублей. */
      it(`${mode}: lost upload and create replies, reload, real bytes/read denial and no duplicate rows/PUT`, async () => {
        const beforePuts = puts(),
          beforeCreates = calls("createPost").length;
        const text = `${prefix}-${mode}-post`,
          document = `${prefix}-${mode}.txt`;
        let form = await open(mode);
        await field(form).fill(text);
        await form.getByRole("button", { name: "Клуб", exact: true }).click();
        await choose(form, "Документ", document, Buffer.from("0123456789"));
        await choose(form, "Аудио", `${prefix}-${mode}.wav`, wavFixture());
        const droppedUpload = proxy.arm(
          "admin.uploadPrivateAttachment",
          "drop",
        );
        await submit(form, mode).click();
        await droppedUpload.reached;
        await expect.poll(() => messages.length).toBe(1);
        expect(calls("uploadPrivateAttachment").at(-1)?.status).toBe(200);
        expect(puts()).toBe(beforePuts + 1);
        expect(await rows("SELECT id FROM posts WHERE text=?", [text])).toEqual(
          [],
        );
        const ledger = await rows(
          "SELECT * FROM private_attachment_uploads WHERE filename=?",
          [document],
        );
        expect(ledger).toHaveLength(1);
        expect(ledger[0].state).toBe("ready");
        form = await reload(form, mode);
        await recover(form);
        await expect.poll(() => submit(form, mode).isEnabled()).toBe(true);
        expect(puts()).toBe(beforePuts + 1);
        const droppedCreate = proxy.arm("admin.createPost", "drop");
        await submit(form, mode).click();
        await droppedCreate.reached;
        await expect.poll(() => messages.length).toBe(2);
        expect(calls("createPost").at(-1)?.status).toBe(200);
        form = await reload(form, mode);
        await recover(form);
        await expect.poll(() => form.count()).toBe(0);
        const created = await rows("SELECT * FROM posts WHERE text=?", [text]);
        expect(created).toHaveLength(1);
        expect(created[0].target).toBe("club");
        posts.set(mode, created[0].id);
        const media = await rows(
          "SELECT * FROM post_media WHERE postId=? ORDER BY id",
          [created[0].id],
        );
        expect(media).toHaveLength(2);
        expect(
          await rows(
            "SELECT postId FROM post_creation_requests WHERE postId=?",
            [created[0].id],
          ),
        ).toHaveLength(1);
        expect(puts()).toBe(beforePuts + 2);
        expect(calls("createPost").length).toBe(beforeCreates + 2);
        expect(calls("uploadMedia")).toEqual([]);
        for (const item of media)
          expect(item.url).toBe(`/api/media/post-attachments/${item.id}`);
        const doc = media.find((item) => item.type === "document")!,
          audio = media.find((item) => item.type === "audio")!;
        await identity(98912);
        const allowed = await read(doc.url);
        expect(allowed.status()).toBe(200);
        expect(await allowed.text()).toBe("0123456789");
        expect(allowed.headers()["cache-control"]).toBe("private, no-store");
        expect((await read(doc.url, "HEAD")).headers()["content-length"]).toBe(
          "10",
        );
        const range = await read(audio.url, "GET", "bytes=0-3");
        expect(range.status()).toBe(206);
        expect(await range.text()).toBe("RIFF");
        expect(range.headers()["content-range"]).toBe("bytes 0-3/46");
        await conn.query(
          "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId=?",
          [`editor-paid-${run}`],
        );
        const beforeDenied = api.commands.length;
        for (const method of ["GET", "HEAD"])
          expect((await read(doc.url, method)).status()).toBe(404);
        expect(api.commands.length).toBe(beforeDenied);
        await browser.context.clearCookies();
        expect((await read(doc.url)).status()).toBe(404);
        const direct = await fetch(
          `${endpoint}/${Bucket}/feed/documents/private-v1/${ledger[0].assetId}`,
          {
            method: "HEAD",
            signal: AbortSignal.timeout(10000),
            redirect: "error",
          },
        );
        expect(direct.status).toBe(403);
        await direct.body?.cancel();
      }, 90000);

      /** Для обоих редакторов проверяет сохранение прежних вложений и отсутствие повторной привязки после потери update-ответа. */
      it(`${mode}: editing retains existing files; lost update reply cannot bind twice`, async () => {
        const id = posts.get(mode)!;
        expect(id).toBeTypeOf("number");
        const old = await rows(
          "SELECT id FROM post_media WHERE postId=? ORDER BY id",
          [id],
        );
        const beforePuts = puts(),
          beforeUpdates = calls("updatePost").length;
        let form = await open(mode, true);
        expect(await field(form).inputValue()).toBe(`${prefix}-${mode}-post`);
        await choose(
          form,
          "Документ",
          `${prefix}-${mode}-edit.txt`,
          Buffer.from("edit bytes"),
        );
        const lost = proxy.arm("admin.uploadPrivateAttachment", "drop");
        await submit(form, mode, true).click();
        await lost.reached;
        await expect.poll(() => messages.length).toBe(1);
        form = await reload(form, mode, true);
        await recover(form);
        await expect
          .poll(() => submit(form, mode, true).isEnabled())
          .toBe(true);
        const lostEdit = proxy.arm("admin.updatePost", "drop");
        await submit(form, mode, true).click();
        await lostEdit.reached;
        await expect.poll(() => messages.length).toBe(2);
        const after = await rows(
          "SELECT id FROM post_media WHERE postId=? ORDER BY id",
          [id],
        );
        expect(after).toHaveLength(3);
        expect(after.slice(0, 2)).toEqual(old);
        expect(puts()).toBe(beforePuts + 1);
        expect(calls("updatePost").at(-1)?.status).toBe(200);
        form = await reload(form, mode, true);
        expect(await submit(form, mode, true).isDisabled()).toBe(true);
        expect(
          await form
            .getByRole("button", { name: "Проверить сохранение", exact: true })
            .count(),
        ).toBe(0);
        expect(calls("updatePost").length).toBe(beforeUpdates + 1);
        expect(
          await rows("SELECT id FROM post_media WHERE postId=?", [id]),
        ).toHaveLength(3);
        // Explicitly discard only this local journal after independent SQL confirmation.
        await form
          .getByRole("button", {
            name: "Проверил список — удалить локальную копию",
            exact: true,
          })
          .click();
        await expect.poll(() => form.count()).toBe(0);
      }, 60000);

      for (const stage of ["upload", "status"] as const) {
        /** Меняет аккаунт во время удержанного upload/status-ответа и проверяет изоляцию ключей и восстановление только прежним владельцем. */
        it(`${mode}: account switch during ${stage} ignores late real receipt and cannot expose the owner's intent`, async () => {
          const name = `${prefix}-${mode}-${stage}.txt`,
            text = `${prefix}-${mode}-${stage}`;
          const beforePuts = puts();
          let form = await open(mode);
          await field(form).fill(text);
          await choose(
            form,
            "Документ",
            name,
            Buffer.from("account-private bytes"),
          );
          const upload = proxy.arm(
            "admin.uploadPrivateAttachment",
            stage === "upload" ? "hold" : "drop",
          );
          await submit(form, mode).click();
          await upload.reached;
          if (stage === "status")
            await expect.poll(() => messages.length).toBe(1);
          const status =
            stage === "status"
              ? proxy.arm("admin.privateAttachmentStatus", "hold")
              : undefined;
          if (status) {
            await recover(form);
            await status.reached;
          }
          const ledger = await rows(
            "SELECT * FROM private_attachment_uploads WHERE filename=?",
            [name],
          );
          expect(ledger).toHaveLength(1);
          expect(ledger[0].state).toBe("ready");
          expect(ledger[0].postId).toBeNull();
          await identity(98911);
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
          await expect.poll(() => form.count()).toBe(0);
          await page
            .getByRole("button", {
              name: mode === "full" ? "Новый" : "Новый пост",
              exact: true,
            })
            .first()
            .click();
          form = page.getByRole("dialog", { name: "Редактор публикации" });
          await expect
            .poll(() =>
              form.getByText("Проверяем сохранённый черновик…").count(),
            )
            .toBe(0);
          expect(await field(form).inputValue()).toBe("");
          expect(await form.getByText(name, { exact: true }).count()).toBe(0);
          const key = await page.evaluate(
            (slot) =>
              new Promise<string>((resolve, reject) => {
                const opening = indexedDB.open("darcy-post-drafts", 1);
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                  const db = opening.result,
                    tx = db.transaction("drafts", "readonly"),
                    get = tx.objectStore("drafts").get(`98910:${slot}`);
                  get.onsuccess = () =>
                    resolve(get.result.save.privateUploads[0][1].key);
                  tx.oncomplete = () => db.close();
                };
              }),
            mode === "full" ? "full:new" : "quick:new:feed",
          );
          const foreign = await browser.context.request.get(
            `${browser.origin}/api/trpc/admin.privateAttachmentStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: key }))}`,
          );
          expect(foreign.status()).toBe(200);
          expect(
            superjson.deserialize((await foreign.json()).result.data),
          ).toEqual({ state: "notRecorded" });
          status?.release();
          upload.release();
          await expect
            .poll(() =>
              form
                .getByText("Черновик сохранён на этом устройстве", {
                  exact: true,
                })
                .isVisible(),
            )
            .toBe(true);
          expect(await field(form).inputValue()).toBe("");
          expect(
            await rows("SELECT id FROM posts WHERE text=?", [text]),
          ).toEqual([]);
          await identity();
          form = await reload(form, mode);
          expect(await field(form).inputValue()).toBe(text);
          await recover(form);
          await expect.poll(() => submit(form, mode).isEnabled()).toBe(true);
          expect(puts()).toBe(beforePuts + 1);
          await submit(form, mode).click();
          await expect.poll(() => form.count()).toBe(0);
          const saved = await rows("SELECT id FROM posts WHERE text=?", [text]);
          expect(saved).toHaveLength(1);
          expect(
            await rows("SELECT id FROM post_media WHERE postId=?", [
              saved[0].id,
            ]),
          ).toHaveLength(1);
          expect(
            await rows(
              "SELECT assetId FROM private_attachment_uploads WHERE filename=?",
              [name],
            ),
          ).toHaveLength(1);
        }, 60000);
      }
    }
  },
);
