import { afterAll, beforeAll, expect, it } from "vitest";
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
        contents: `export {ArticleCreationJournal} from './apps/frontend/src/domain/content/article-creation-journal'; export {setPersonalDataOwner} from './apps/frontend/src/shared/browser/storage';`,
        resolveDir: root,
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "articleJournal",
      tsconfig: `${root}apps/frontend/tsconfig.json`,
    })
  ).outputFiles[0].text;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});
async function open(page: Page) {
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Own article journal fixture</title>",
    }),
  );
  await page.goto("http://127.0.0.1:19191/");
  await page.addScriptTag({ content: bundle });
}
native(
  "real IndexedDB persists article File bytes and stable key across reload before any upload",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      await page.evaluate(async () => {
        const { ArticleCreationJournal, setPersonalDataOwner } = (window as any)
          .articleJournal;
        setPersonalDataOwner(101);
        await new ArticleCreationJournal(101).prepare(
          {
            title: "Article",
            coverUrl: null,
            access: "club",
            published: true,
            sections: [
              { type: "link", url: "local-content:article-document-0001" },
            ],
          },
          {
            editingId: null,
            files: [
              {
                usage: "articleDocument",
                key: "article-document-0001",
                file: new File(["document bytes"], "doc.txt", {
                  type: "text/plain",
                  lastModified: 1234,
                }),
              },
            ],
          },
        );
      });
      await open(page);
      const result = await page.evaluate(async () => {
        const { ArticleCreationJournal, setPersonalDataOwner } = (window as any)
          .articleJournal;
        setPersonalDataOwner(101);
        const journal = new ArticleCreationJournal(101),
          record = await journal.load();
        return {
          phase: record.media.phase,
          bytes: await record.media.files[0].file.text(),
          type: record.media.files[0].file.type,
          name: record.media.files[0].file.name,
          lastModified: record.media.files[0].file.lastModified,
          key: record.media.files[0].key,
          payload: record.payload,
        };
      });
      expect(result).toMatchObject({
        phase: "upload",
        bytes: "document bytes",
        type: "text/plain",
        name: "doc.txt",
        lastModified: 1234,
        key: "article-document-0001",
        payload: {
          sections: [
            { type: "link", url: "local-content:article-document-0001" },
          ],
        },
      });
    } finally {
      await context.close();
    }
  },
);
native(
  "checkpoint CAS rejects another tab and write phase is frozen instead of replaying an unknown edit",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const result = await page.evaluate(async () => {
        const { ArticleCreationJournal, setPersonalDataOwner } = (window as any)
          .articleJournal;
        setPersonalDataOwner(101);
        const a = new ArticleCreationJournal(101),
          b = new ArticleCreationJournal(101);
        const { record } = await a.prepare(
          {
            title: "Edit",
            coverUrl: null,
            access: "club",
            published: false,
            sections: [
              { type: "link", url: "local-content:article-document-0001" },
            ],
          },
          {
            editingId: 7,
            files: [
              {
                usage: "articleDocument",
                key: "article-document-0001",
                file: new File(["bytes"], "doc.txt", { type: "text/plain" }),
              },
            ],
          },
        );
        const stale = await b.load();
        const next = await a.checkpoint(record, record.payload, "upload");
        let conflict = false;
        try {
          await b.checkpoint(stale, stale.payload, "upload");
        } catch {
          conflict = true;
        }
        const file = next.media.files[0];
        file.attempted = true;
        file.receipt = {
          state: "ready",
          assetId: "3af23d8c-140f-454b-a123-123456789abc",
          usage: "articleDocument",
          filename: "doc.txt",
          mimeType: "text/plain; charset=utf-8",
          fileSize: 5,
          url: "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc",
        };
        const written = await a.checkpoint(
          next,
          {
            ...next.payload,
            sections: [{ type: "link", url: file.receipt.url }],
          },
          "write",
        );
        let frozen = false;
        try {
          await a.checkpoint(
            written,
            { ...written.payload, title: "Changed" },
            "upload",
          );
        } catch {
          frozen = true;
        }
        return {
          conflict,
          frozen,
          editingId: (await a.load()).media.editingId,
        };
      });
      expect(result).toEqual({ conflict: true, frozen: true, editingId: 7 });
    } finally {
      await context.close();
    }
  },
);
native(
  "another account cannot load or checkpoint the original article operation",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      expect(
        await page.evaluate(async () => {
          const { ArticleCreationJournal, setPersonalDataOwner } = (
            window as any
          ).articleJournal;
          setPersonalDataOwner(101);
          const journal = new ArticleCreationJournal(101);
          const { record } = await journal.prepare(
            {
              title: "Private",
              coverUrl: null,
              access: "club",
              published: false,
              sections: [
                { type: "link", url: "local-content:article-document-0001" },
              ],
            },
            {
              editingId: null,
              files: [
                {
                  usage: "articleDocument",
                  key: "article-document-0001",
                  file: new File(["bytes"], "doc.txt", { type: "text/plain" }),
                },
              ],
            },
          );
          setPersonalDataOwner(202);
          let refused = false;
          try {
            await journal.checkpoint(record, record.payload, "upload");
          } catch {
            refused = true;
          }
          return {
            refused,
            foreign: await new ArticleCreationJournal(202).load(),
          };
        }),
      ).toEqual({ refused: true, foreign: null });
    } finally {
      await context.close();
    }
  },
);
