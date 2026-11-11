import { expect, it } from "vitest";
import {
  expect as ui,
  type Page,
  type BrowserContext,
  type APIResponse,
} from "@playwright/test";
import type { RowDataPacket } from "mysql2/promise";
import type { httpResponseFaultProxy } from "./http-response-fault-proxy";
import superjson from "superjson";
type Fixture = {
  page: Page;
  context: BrowserContext;
  origin: string;
  prefix: string;
  png: Buffer;
  proxy: Awaited<ReturnType<typeof httpResponseFaultProxy>>;
  rows: (sql: string, args?: unknown[]) => Promise<RowDataPacket[]>;
  execute: (sql: string, args?: unknown[]) => Promise<unknown>;
  identity: (id?: number) => Promise<void>;
  puts: () => number;
  read: (url: string, method?: string, range?: string) => Promise<APIResponse>;
  denied: (url: string) => Promise<void>;
};
/** Share the existing owned SQL/S3 fixture; faults affect completed HTTP replies only. */
export function registerPrivateCommentS3BrowserCases(fixture: () => Fixture) {
  // Совмещает настоящий SQL/S3 wire и потерю уже выполненных ответов, проверяя один файл и один комментарий исходного владельца.

  for (const stage of ["lost", "upload", "status"] as const)
    it(`comment: ${stage} response recovery preserves one private photo and one original-owner comment`, async () => {
    // Сценарий: Для потери ACK загрузки, удержанной загрузки и удержанного status проверяются один закрытый файл, один комментарий исходного автора, смена владельца и Range после привязки.

      const f = fixture(),
        { page, proxy } = f;
      const text = `${f.prefix}-comment-${stage}`,
        beforePuts = f.puts();
      await f.execute(
        "INSERT INTO posts(text,photos,tags,status,published,target,publishedAt,createdAt) VALUES(?,'[]',JSON_ARRAY('community'),'published',1,'club',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        [text],
      );
      const postId = (
        await f.rows("SELECT id FROM posts WHERE text=?", [text])
      )[0].id;
      const input = () => /* Находит поле комментария повторно после восстановления страницы или смены аккаунта. */ page.getByPlaceholder("Написать комментарий...");
      const button = (name: string) =>
        /* Выбирает точную кнопку действия, чтобы общая подпись не попала в другую форму. */ page.getByRole("button", { name, exact: true });
      const open = async (restore = false) => {
        // Открывает исходный пост и при необходимости явно принимает его durable отправку.

        await page.goto(`${f.origin}/post/${postId}`);
        await ui(input()).toBeVisible();
        if (restore) await button("Восстановить отправку").click();
      };
      await open();
      await input().fill(text);
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        button("Фото (0/2)").click(),
      ]);
      await chooser.setFiles({
        name: `${text}.png`,
        mimeType: "image/png",
        buffer: f.png,
      });
      await ui(page.locator('img[src^="blob:"]')).toHaveCount(1);
      const blob = await page.locator('img[src^="blob:"]').getAttribute("src");
      expect(f.puts()).toBe(beforePuts);
      const upload = proxy.arm(
        "club.uploadPrivateCommentPhoto",
        stage === "upload" ? "hold" : "drop",
      );
      let status: ReturnType<typeof proxy.arm> | undefined;
      try {
        await button("Отправить").click();
        await upload.reached;
        if (stage !== "upload")
          await ui(button("Повторить отправку")).toBeEnabled();
        const files = await f.rows(
          "SELECT * FROM private_content_files WHERE targetPostId=?",
          [postId],
        );
        expect(files).toHaveLength(1);
        expect(files[0]).toMatchObject({
          actorUserId: 98920,
          usage: "commentPhoto",
          state: "ready",
          parentId: null,
        });
        const url = `/api/media/content-files/${files[0].assetId}`;
        await f.denied(url);
        if (stage === "status") {
          status = proxy.arm("club.privateCommentPhotoStatus", "hold");
          await button("Повторить отправку").click();
          await status.reached;
        }
        if (stage !== "lost") {
          await f.identity(98921);
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
          await ui(input()).toHaveValue("");
          await ui(page.locator('img[src^="blob:"]')).toHaveCount(0);
          expect(
            await page.evaluate(async (value) => {
              try {
                await fetch(value!);
                return "readable";
              } catch {
                return "revoked";
              }
            }, blob),
          ).toBe("revoked");
          const key = await page.evaluate(
            (postId) =>
              new Promise<string>((resolve, reject) => {
                const opening = indexedDB.open("darcy-private-comments", 1);
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                  const db = opening.result,
                    tx = db.transaction("operations", "readonly"),
                    get = tx.objectStore("operations").get(`98920:${postId}`);
                  get.onsuccess = () => resolve(get.result.record.files[0].key);
                  tx.oncomplete = () => db.close();
                };
              }),
            postId,
          );
          const foreign = await f.context.request.get(
            `${f.origin}/api/trpc/club.privateCommentPhotoStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: key }))}`,
          );
          expect(foreign.status()).toBe(200);
          expect(
            superjson.deserialize((await foreign.json()).result.data),
          ).toEqual({ state: "notRecorded" });
          status?.release();
          upload.release();
          await ui(input()).toHaveValue("");
          expect(
            await f.rows("SELECT id FROM post_comments WHERE postId=?", [
              postId,
            ]),
          ).toEqual([]);
          await f.identity();
        }
        await open(true);
        await ui(input()).toHaveValue(text);
        const lostWrite =
          stage === "lost" ? proxy.arm("club.addComment", "drop") : null;
        await button("Повторить отправку").click();
        if (lostWrite) {
          await lostWrite.reached;
          await ui(button("Повторить отправку")).toBeEnabled();
          await open(true);
          await button("Повторить отправку").click();
        }
        await ui(input()).toHaveValue("");
        const comments = await f.rows(
          "SELECT * FROM post_comments WHERE postId=?",
          [postId],
        );
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ userId: 98920, text });
        expect(
          typeof comments[0].photos === "string"
            ? JSON.parse(comments[0].photos)
            : comments[0].photos,
        ).toEqual([url]);
        expect(
          await f.rows(
            "SELECT requestKey FROM comment_creation_requests WHERE commentId=?",
            [comments[0].id],
          ),
        ).toHaveLength(1);
        expect(
          (
            await f.rows(
              "SELECT * FROM private_content_files WHERE targetPostId=?",
              [postId],
            )
          )[0],
        ).toMatchObject({ parentKind: "comment", parentId: comments[0].id });
        expect(f.puts()).toBe(beforePuts + 1);
        expect(
          proxy.calls.filter((call) =>
            call.pathname.includes("club.uploadCommentPhoto"),
          ),
        ).toEqual([]);
        await f.identity(98922);
        const response = await f.read(url);
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        const bytes = await response.body(),
          range = await f.read(url, "GET", "bytes=0-3");
        expect(range.status()).toBe(206);
        expect(await range.body()).toEqual(bytes.subarray(0, 4));
        expect((await f.read(url, "HEAD")).headers()["content-length"]).toBe(
          String(bytes.length),
        );
        await f.execute(
          "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId=?",
          [f.prefix],
        );
        await f.denied(url);
      } finally {
        status?.release();
        upload.release();
      }
    }, 180000);
}
