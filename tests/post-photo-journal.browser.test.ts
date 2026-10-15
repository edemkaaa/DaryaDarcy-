import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "@playwright/test";
import type { PostRecoveryJournal } from "../apps/frontend/src/domain/post/recovery-store";
import type { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import type { serializePostDraft } from "../apps/frontend/src/domain/post/draft";

declare global {
  interface Window {
    cfJournal: {
      PostRecoveryJournal: typeof PostRecoveryJournal;
      PostSaveCoordinator: typeof PostSaveCoordinator;
      serializePostDraft: typeof serializePostDraft;
      setPersonalDataOwner: (id: number | null) => void;
    };
  }
}
const enabled = process.env.DARYADARCY_LOCAL_BROWSER === "1";
let browser: Browser;
let bundle: string;
beforeAll(async () => {
  if (!enabled) return;
  const root = new URL("../", import.meta.url).pathname;
  const result = await build({
    stdin: {
      contents: `export {PostRecoveryJournal} from './apps/frontend/src/domain/post/recovery-store';
        export {PostSaveCoordinator} from './apps/frontend/src/domain/post/save-post';
        export {serializePostDraft} from './apps/frontend/src/domain/post/draft';
        export {setPersonalDataOwner} from './apps/frontend/src/shared/browser/storage';`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    globalName: "cfJournal",
    tsconfig: `${root}apps/frontend/tsconfig.json`,
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

async function open(page: Page) {
  // Only the document transport is synthetic. File/IndexedDB/storage code is real.
  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Own CF journal fixture</title>",
    }),
  );
  await page.goto("http://127.0.0.1:19191/");
  await page.addScriptTag({ content: bundle });
}
const native = enabled ? it : it.skip;
native(
  "persists photo bytes without Blob storage and restores editor/coordinator aliases after reload",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const packed = await page.evaluate(async () => {
        const {
          PostRecoveryJournal,
          PostSaveCoordinator,
          setPersonalDataOwner,
        } = window.cfJournal;
        setPersonalDataOwner(101);
        const journal = new PostRecoveryJournal(101, "photo-journal");
        await journal.load();
        const photo = {
          key: "private-photo-intent-0001",
          file: new File(["original bytes"], "photo.png", {
            type: "image/png",
            lastModified: 1234,
          }),
          attempted: true,
        };
        const editor = {
          draft: {
            text: "Photo",
            photos: ["local-photo:private-photo-intent-0001"],
            videos: [],
            tags: [],
            target: "club" as const,
            status: "published" as const,
            publishedAt: new Date("2026-10-16"),
            scheduledAt: null,
            sortOrder: 0,
          },
          attachments: [],
          removedIds: [],
          pending: [],
          privatePhotos: [photo],
        };
        const coordinator = new PostSaveCoordinator();
        await journal.write(editor, {
          ...coordinator.snapshot(),
          phase: "upload",
          privatePhotos: [photo],
        });
        return await new Promise((resolve, reject) => {
          const request = indexedDB.open("darcy-post-drafts", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("drafts", "readonly");
            const read = tx.objectStore("drafts").get("101:photo-journal");
            read.onsuccess = () => {
              const value = read.result;
              const photo = value.editor.privatePhotos[0];
              resolve({
                hasFile: "file" in photo,
                bytes: photo.fileData?.bytes.byteLength,
                same: photo === value.save.privatePhotos[0],
              });
            };
            tx.oncomplete = () => db.close();
          };
        });
      });
      expect(packed).toEqual({ hasFile: false, bytes: 14, same: true });
      await page.reload();
      await page.addScriptTag({ content: bundle });
      const restored = await page.evaluate(async () => {
        const { PostRecoveryJournal, setPersonalDataOwner } = window.cfJournal;
        setPersonalDataOwner(101);
        const record = await new PostRecoveryJournal(
          101,
          "photo-journal",
        ).load();
        const photo = record!.editor.privatePhotos![0];
        return {
          key: photo.key,
          bytes: await photo.file.text(),
          name: photo.file.name,
          type: photo.file.type,
          lastModified: photo.file.lastModified,
          same: photo === record!.save.privatePhotos![0],
        };
      });
      expect(restored).toEqual({
        key: "private-photo-intent-0001",
        bytes: "original bytes",
        name: "photo.png",
        type: "image/png",
        lastModified: 1234,
        same: true,
      });
    } finally {
      await context.close();
    }
  },
);

native(
  "rejects a forged recovered photo receipt before exposing the draft",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const result = await page.evaluate(async () => {
        const {
          PostRecoveryJournal,
          PostSaveCoordinator,
          setPersonalDataOwner,
        } = window.cfJournal;
        setPersonalDataOwner(101);
        const journal = new PostRecoveryJournal(101, "corrupt-photo");
        await journal.load();
        const photo = {
          key: "private-photo-intent-0001",
          file: new File(["bytes"], "photo.png", { type: "image/png" }),
          attempted: true,
          receipt: {
            state: "ready" as const,
            assetId: "3af23d8c-140f-454b-a123-123456789abc",
            usage: "postPhoto" as const,
            filename: "photo.png",
            mimeType: "image/webp" as const,
            fileSize: 5,
            url: "https://storage.example.test/private/file",
          },
        };
        await journal.write(
          {
            draft: {
              text: "Photo",
              photos: ["local-photo:private-photo-intent-0001"],
              videos: [],
              tags: [],
              target: "club",
              status: "published",
              publishedAt: new Date(),
              scheduledAt: null,
              sortOrder: 0,
            },
            attachments: [],
            removedIds: [],
            pending: [],
            privatePhotos: [photo],
          },
          { ...new PostSaveCoordinator().snapshot(), privatePhotos: [photo] },
        );
        try {
          await new PostRecoveryJournal(101, "corrupt-photo").load();
          return "accepted";
        } catch {
          return "rejected";
        }
      });
      expect(result).toBe("rejected");
    } finally {
      await context.close();
    }
  },
);

native(
  "switching account cannot read or overwrite the original owner's photo",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const result = await page.evaluate(async () => {
        const {
          PostRecoveryJournal,
          PostSaveCoordinator,
          setPersonalDataOwner,
        } = window.cfJournal;
        setPersonalDataOwner(101);
        const journal = new PostRecoveryJournal(101, "owner-photo");
        await journal.load();
        const photo = {
          key: "private-photo-intent-0001",
          file: new File(["owner bytes"], "photo.png", { type: "image/png" }),
        };
        const editor = {
          draft: {
            text: "Photo",
            photos: ["local-photo:private-photo-intent-0001"],
            videos: [],
            tags: [],
            target: "club" as const,
            status: "published" as const,
            publishedAt: new Date(),
            scheduledAt: null,
            sortOrder: 0,
          },
          attachments: [],
          removedIds: [],
          pending: [],
          privatePhotos: [photo],
        };
        await journal.write(editor, new PostSaveCoordinator().snapshot());
        setPersonalDataOwner(102);
        let foreignRead = false,
          foreignWrite = false;
        try {
          await new PostRecoveryJournal(101, "owner-photo").load();
          foreignRead = true;
        } catch {}
        try {
          await journal.write(editor, new PostSaveCoordinator().snapshot());
          foreignWrite = true;
        } catch {}
        const own = await new PostRecoveryJournal(102, "owner-photo").load();
        setPersonalDataOwner(101);
        const restored = await new PostRecoveryJournal(
          101,
          "owner-photo",
        ).load();
        return {
          foreignRead,
          foreignWrite,
          own,
          bytes: await restored!.editor.privatePhotos![0].file.text(),
        };
      });
      expect(result).toEqual({
        foreignRead: false,
        foreignWrite: false,
        own: null,
        bytes: "owner bytes",
      });
    } finally {
      await context.close();
    }
  },
);

native(
  "a different File cannot replace a recovered upload intent through the same key",
  async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await open(page);
      const result = await page.evaluate(async () => {
        const {
          PostRecoveryJournal,
          PostSaveCoordinator,
          setPersonalDataOwner,
        } = window.cfJournal;
        setPersonalDataOwner(101);
        const journal = new PostRecoveryJournal(101, "alias-photo");
        await journal.load();
        const photo = {
          key: "private-photo-intent-0001",
          file: new File(["original"], "photo.png", { type: "image/png" }),
        };
        const replacement = {
          ...photo,
          file: new File(["replacement"], "photo.png", { type: "image/png" }),
        };
        await journal.write(
          {
            draft: {
              text: "Photo",
              photos: ["local-photo:private-photo-intent-0001"],
              videos: [],
              tags: [],
              target: "club",
              status: "published",
              publishedAt: new Date(),
              scheduledAt: null,
              sortOrder: 0,
            },
            attachments: [],
            removedIds: [],
            pending: [],
            privatePhotos: [replacement],
          },
          {
            ...new PostSaveCoordinator().snapshot(),
            phase: "upload",
            privatePhotos: [photo],
          },
        );
        try {
          await new PostRecoveryJournal(101, "alias-photo").load();
          return "accepted";
        } catch {
          return "rejected";
        }
      });
      expect(result).toBe("rejected");
    } finally {
      await context.close();
    }
  },
);
