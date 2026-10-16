import { beforeAll, afterAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "@playwright/test";
const native = process.env.DARYADARCY_LOCAL_BROWSER === "1" ? it : it.skip;
let browser: Browser, bundle: string;
beforeAll(async () => {
  if (process.env.DARYADARCY_LOCAL_BROWSER !== "1") return;
  const root = new URL("../", import.meta.url).pathname;
  bundle = (
    await build({
      stdin: {
        contents: `export {PrivateCommentJournal} from './apps/frontend/src/domain/post/private-comment-journal'; export {preparePrivateComment,savePrivateComment} from './apps/frontend/src/domain/post/private-comment-save'; export {setPersonalDataOwner} from './apps/frontend/src/shared/browser/storage';`,
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "commentJournal",
      tsconfig: `${root}apps/frontend/tsconfig.json`,
    })
  ).outputFiles[0].text;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});
native(
  "concurrent prepares claim one slot instead of replacing another tab's comment",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      expect(
        await page.evaluate(async () => {
          const {
            PrivateCommentJournal,
            preparePrivateComment,
            setPersonalDataOwner,
          } = (window as any).commentJournal;
          setPersonalDataOwner(101);
          const make = (text: string) =>
            preparePrivateComment(101, { postId: 42, text }, [
              {
                key: `comment-file-intent-${text}`,
                file: new File(["bytes"], "photo.png", { type: "image/png" }),
              },
            ]);
          const a = new PrivateCommentJournal(101, 42),
            b = new PrivateCommentJournal(101, 42);
          const results = await Promise.all([
            a.prepare(make("first")),
            b.prepare(make("second")),
          ]);
          const loaded = await a.load();
          return {
            restored: results.map((value) => value.restored).sort(),
            sameKey: results.every((value) => value.record.key === loaded.key),
            sameText: results.every(
              (value) => value.record.text === loaded.text,
            ),
          };
        }),
      ).toEqual({ restored: [false, true], sameKey: true, sameText: true });
    } finally {
      await context.close();
    }
  },
);
async function open(page: Page) {
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Own comment journal fixture</title>",
    }),
  );
  await page.goto("http://127.0.0.1:19191/");
  await page.addScriptTag({ content: bundle });
}
native(
  "comment File bytes, reply, key and original post survive a real document reload",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const key = await page.evaluate(async () => {
        const {
          PrivateCommentJournal,
          preparePrivateComment,
          setPersonalDataOwner,
        } = (window as any).commentJournal;
        setPersonalDataOwner(101);
        const record = preparePrivateComment(
          101,
          { postId: 42, text: "original", parentId: 7 },
          [
            {
              key: "comment-file-intent-0001",
              file: new File(["private bytes"], "photo.png", {
                type: "image/png",
                lastModified: 1234,
              }),
            },
          ],
        );
        await new PrivateCommentJournal(101, 42).prepare(record);
        return record.key;
      });
      await open(page);
      const result = await page.evaluate(async () => {
        const { PrivateCommentJournal, setPersonalDataOwner } = (window as any)
          .commentJournal;
        setPersonalDataOwner(101);
        const record = await new PrivateCommentJournal(101, 42).load();
        const { file } = record.files[0];
        return {
          key: record.key,
          postId: record.postId,
          parentId: record.parentId,
          text: record.text,
          phase: record.phase,
          fileKey: record.files[0].key,
          bytes: await file.text(),
          type: file.type,
          name: file.name,
          lastModified: file.lastModified,
        };
      });
      expect(result).toEqual({
        key,
        postId: 42,
        parentId: 7,
        text: "original",
        phase: "upload",
        fileKey: "comment-file-intent-0001",
        bytes: "private bytes",
        type: "image/png",
        name: "photo.png",
        lastModified: 1234,
      });
    } finally {
      await context.close();
    }
  },
);
native(
  "atomic revision ownership rejects a stale checkpoint and stale clear from another instance",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      expect(
        await page.evaluate(async () => {
          const {
            PrivateCommentJournal,
            preparePrivateComment,
            setPersonalDataOwner,
          } = (window as any).commentJournal;
          setPersonalDataOwner(101);
          const a = new PrivateCommentJournal(101, 42),
            b = new PrivateCommentJournal(101, 42);
          const record = preparePrivateComment(
            101,
            { postId: 42, text: "original" },
            [
              {
                key: "comment-file-intent-0001",
                file: new File(["bytes"], "photo.png", { type: "image/png" }),
              },
            ],
          );
          await a.prepare(record);
          const stale = await b.load();
          record.files[0].attempted = true;
          await a.checkpoint(record);
          let refused = 0;
          for (const work of [() => b.checkpoint(stale), () => b.clear(stale)])
            try {
              await work();
            } catch {
              refused++;
            }
          const restored = await b.prepare(
            preparePrivateComment(101, { postId: 42, text: "replacement" }, [
              {
                key: "comment-file-intent-0002",
                file: new File(["different"], "photo.png", {
                  type: "image/png",
                }),
              },
            ]),
          );
          return {
            refused,
            restored: restored.restored,
            text: restored.record.text,
            attempted: restored.record.files[0].attempted,
          };
        }),
      ).toEqual({
        refused: 2,
        restored: true,
        text: "original",
        attempted: true,
      });
    } finally {
      await context.close();
    }
  },
);
native(
  "same-key byte substitution and backwards write transitions cannot replace an unknown comment",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      expect(
        await page.evaluate(async () => {
          const {
            PrivateCommentJournal,
            preparePrivateComment,
            savePrivateComment,
            setPersonalDataOwner,
          } = (window as any).commentJournal;
          setPersonalDataOwner(101);
          const journal = new PrivateCommentJournal(101, 42);
          const record = preparePrivateComment(
            101,
            { postId: 42, text: "original" },
            [
              {
                key: "comment-file-intent-0001",
                file: new File(["bytes"], "photo.png", {
                  type: "image/png",
                  lastModified: 1234,
                }),
              },
            ],
          );
          await journal.prepare(record);
          const file = record.files[0].file;
          record.files[0].file = new File(["other"], file.name, {
            type: file.type,
            lastModified: file.lastModified,
          });
          let substituted = false;
          try {
            await journal.checkpoint(record);
          } catch {
            substituted = true;
          }
          record.files[0].file = file;
          let sent = 0;
          try {
            await savePrivateComment(
              record,
              {
                upload: async (input: { filename: string }) => ({
                  state: "ready",
                  assetId: "3af23d8c-140f-454b-a123-123456789abc",
                  usage: "commentPhoto",
                  filename: input.filename,
                  mimeType: "image/webp",
                  fileSize: 80,
                  url: "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc",
                }),
                status: async () => ({ state: "notRecorded" }),
                add: async () => {
                  sent++;
                  throw Error("lost reply");
                },
              },
              { assertCurrent() {}, signal: new AbortController().signal },
              (value: unknown) => journal.checkpoint(value),
            );
          } catch {}
          const frozen = await journal.load();
          frozen.phase = "upload";
          delete frozen.payloadJson;
          let thawed = false;
          try {
            await journal.checkpoint(frozen);
          } catch {
            thawed = true;
          }
          return {
            substituted,
            thawed,
            sent,
            phase: (await journal.load()).phase,
          };
        }),
      ).toEqual({ substituted: true, thawed: true, sent: 1, phase: "write" });
    } finally {
      await context.close();
    }
  },
);
native(
  "another account or another post cannot read or overwrite the original private operation",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      expect(
        await page.evaluate(async () => {
          const {
            PrivateCommentJournal,
            preparePrivateComment,
            setPersonalDataOwner,
          } = (window as any).commentJournal;
          setPersonalDataOwner(101);
          const original = new PrivateCommentJournal(101, 42),
            otherPost = new PrivateCommentJournal(101, 43);
          const record = preparePrivateComment(
            101,
            { postId: 42, text: "original" },
            [
              {
                key: "comment-file-intent-0001",
                file: new File(["bytes"], "photo.png", { type: "image/png" }),
              },
            ],
          );
          await original.prepare(record);
          let refused = 0;
          try {
            await otherPost.prepare(record);
          } catch {
            refused++;
          }
          const post = await otherPost.load();
          setPersonalDataOwner(202);
          for (const work of [
            () => original.load(),
            () => original.checkpoint(record),
            () => original.clear(record),
          ])
            try {
              await work();
            } catch {
              refused++;
            }
          return {
            refused,
            post,
            foreign: await new PrivateCommentJournal(202, 42).load(),
          };
        }),
      ).toEqual({ refused: 4, post: null, foreign: null });
    } finally {
      await context.close();
    }
  },
);
