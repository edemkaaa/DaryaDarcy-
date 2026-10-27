import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

type Journals =
  typeof import("../apps/frontend/src/domain/content/article-creation-journal") &
    typeof import("../apps/frontend/src/domain/content/article-draft-journal") &
    typeof import("../apps/frontend/src/domain/content/article-cover-journal") &
    typeof import("../apps/frontend/src/shared/browser/storage");

it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "real IndexedDB preserves article versions, original snapshots and File bytes in drafts, covers and write intents",
  async () => {
    const bundle = await build({
      stdin: {
        contents: `
    export {ArticleCreationJournal} from '@/domain/content/article-creation-journal';
    export {ArticleDraftJournal} from '@/domain/content/article-draft-journal';
    export {ArticleCoverJournal} from '@/domain/content/article-cover-journal';
    export {setPersonalDataOwner} from '@/shared/browser/storage';`,
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "editJournals",
      tsconfig: resolve("apps/frontend/tsconfig.json"),
    });
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    try {
      const page = await browser.newPage();
      await page.route("**/*", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Revision journals</title>",
        }),
      );
      await page.goto("http://127.0.0.1:19192/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const result = await page.evaluate(async () => {
        const {
          ArticleCreationJournal,
          ArticleCoverJournal,
          ArticleDraftJournal,
          setPersonalDataOwner,
        } = (window as unknown as { editJournals: Journals }).editJournals;
        setPersonalDataOwner(101);
        const file = {
          key: "article-file-original-0001",
          usage: "articleDocument" as const,
          file: new File(["private original bytes"], "original.txt", {
            type: "text/plain",
          }),
        };
        const payload = {
          title: "My draft",
          coverUrl: null,
          access: "club" as const,
          published: true,
          sections: [
            { type: "link" as const, url: `local-content:${file.key}` },
          ],
        };
        const editBase = {
          revision: "opaque:original",
          snapshot: { ...payload, title: "Original server title" },
        };
        await new ArticleDraftJournal(101).save(
          { ...payload, editingId: 9, editBase },
          [file],
          null,
        );
        const cover = new ArticleCoverJournal(101);
        await cover.prepare(
          { ...payload, editingId: 9, editBase },
          {
            base64: "AAAA",
            filename: "cover.png",
            mimeType: "image/png",
            purpose: "publicCover",
          },
          [file],
        );
        const journal = new ArticleCreationJournal(101);
        const intent = await journal.prepare(
          payload,
          { editingId: 9, files: [file] },
          editBase,
        );
        const ready = intent.record;
        ready.media!.files[0].attempted = true;
        ready.media!.files[0].receipt = {
          state: "ready",
          assetId: "00000000-0000-4000-8000-000000000077",
          usage: "articleDocument",
          filename: "original.txt",
          mimeType: "text/plain",
          fileSize: file.file.size,
          url: "/api/media/content-files/00000000-0000-4000-8000-000000000077",
        };
        const upload = await journal.checkpoint(ready, ready.payload, "upload");
        const write = await journal.checkpoint(
          upload,
          {
            ...payload,
            sections: [
              { type: "link", url: ready.media!.files[0].receipt.url! },
            ],
          },
          "write",
        );
        await journal.recordConflict(write, 412);
        const draft = (await new ArticleDraftJournal(101).load())[0];
        const loadedCover = await new ArticleCoverJournal(101).load();
        const loadedIntent = await new ArticleCreationJournal(101).load();
        const own = {
          draft: {
            base: draft.snapshot.editBase,
            bytes: await draft.files[0].file.text(),
          },
          cover: {
            base: loadedCover!.snapshot.editBase,
            bytes: await loadedCover!.files[0].file.text(),
          },
          intent: {
            base: loadedIntent!.editBase,
            bytes: await loadedIntent!.media!.files[0].file.text(),
            conflict: loadedIntent!.editConflict,
            phase: loadedIntent!.media!.phase,
          },
        };
        setPersonalDataOwner(102);
        return {
          own,
          other: {
            drafts: await new ArticleDraftJournal(102).load(),
            cover: await new ArticleCoverJournal(102).load(),
            intent: await new ArticleCreationJournal(102).load(),
          },
        };
      });
      for (const entry of [
        result.own.draft,
        result.own.cover,
        result.own.intent,
      ]) {
        expect(entry.base).toMatchObject({
          revision: "opaque:original",
          snapshot: { title: "Original server title" },
        });
        expect(entry.bytes).toBe("private original bytes");
      }
      expect(result.own.intent).toMatchObject({
        conflict: 412,
        phase: "write",
      });
      expect(result.other).toEqual({ drafts: [], cover: null, intent: null });
    } finally {
      await browser.close();
    }
  },
  20000,
);
