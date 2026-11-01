import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { resolve } from "node:path";

type Journals =
  typeof import("../apps/frontend/src/domain/content/article-draft-journal") &
    typeof import("../apps/frontend/src/shared/browser/storage");

it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "isolates damaged article slots and atomically preserves original File bytes, including on races and storage failures",
  async () => {
    const bundle = await build({
      stdin: {
        contents: `export {ArticleDraftJournal} from '@/domain/content/article-draft-journal';
          export {setPersonalDataOwner} from '@/shared/browser/storage';`,
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      globalName: "draftRecovery",
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
          body: "<!doctype html><title>Draft recovery</title>",
        }),
      );
      await page.goto("http://127.0.0.1:19192/");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const result = await page.evaluate(async () => {
        const { ArticleDraftJournal, setPersonalDataOwner } = (
          window as unknown as { draftRecovery: Journals }
        ).draftRecovery;
        const journal = new ArticleDraftJournal(101);
        setPersonalDataOwner(101);
        const snapshot = {
          editingId: 9,
          title: "Valid draft",
          coverUrl: null,
          access: "club" as const,
          published: false,
          sections: [],
        };
        const valid = await journal.save(snapshot, [], null);
        const file = new File(["original private bytes"], "original.txt", {
          type: "text/plain",
          lastModified: 123456,
        });
        const bad = {
          version: 1,
          ownerId: 101,
          revision: "broken",
          snapshot: {
            editingId: null,
            title: "Keep original",
            sections: "damaged",
          },
          files: [{ key: "file-key", file }],
          unknownField: { keep: true },
        };
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("darcy-article-drafts", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const put = (key: string, value: unknown) =>
          new Promise<void>((resolve, reject) => {
            const tx = database.transaction("drafts", "readwrite");
            tx.objectStore("drafts").put(value, key);
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error);
          });
        const all = () =>
          new Promise<{ key: string; value: unknown }[]>((resolve, reject) => {
            const tx = database.transaction("drafts");
            const entries: { key: string; value: unknown }[] = [];
            const request = tx.objectStore("drafts").openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (cursor) {
                entries.push({ key: String(cursor.key), value: cursor.value });
                cursor.continue();
              }
            };
            tx.oncomplete = () => resolve(entries);
            tx.onabort = () => reject(tx.error);
          });
        const rejected = async (work: () => Promise<unknown>) => {
          try {
            await work();
            return false;
          } catch {
            return true;
          }
        };
        await put("101:new", bad);
        await put("101:10", valid); // Valid body in the wrong slot must be isolated too.
        await put("101:11", undefined);
        await put("102:new", { privateOtherOwner: true });
        const inspection = await journal.inspect();
        const blockedWrite = await rejected(() =>
          journal.save({ ...snapshot, editingId: null }, [], null),
        );
        const blockedUndefined = await rejected(() =>
          journal.save({ ...snapshot, editingId: 11 }, [], null),
        );
        const blockedClear = await rejected(() => journal.clear(null, null));
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...args) {
          if (this.transaction.db.name === "darcy-article-drafts")
            throw new DOMException("Full", "QuotaExceededError");
          return add.apply(this, args);
        };
        const quotaBlocked = await rejected(() =>
          journal.archiveDamaged("101:new"),
        );
        IDBObjectStore.prototype.add = add;
        const afterQuota = await all();
        const remove = IDBObjectStore.prototype.delete;
        IDBObjectStore.prototype.delete = function (...args) {
          if (this.transaction.db.name === "darcy-article-drafts")
            throw new DOMException("Denied", "UnknownError");
          return remove.apply(this, args);
        };
        const deleteBlocked = await rejected(() =>
          journal.archiveDamaged("101:new"),
        );
        IDBObjectStore.prototype.delete = remove;
        const afterDeleteFailure = await all();
        // A real asynchronous add request failure must roll back the queued delete.
        const randomUUID = crypto.randomUUID.bind(crypto);
        const collision =
          randomUUID() as `${string}-${string}-${string}-${string}-${string}`;
        await put(`recovery:101:${collision}`, { existingCopy: true });
        crypto.randomUUID = () => collision;
        const collisionBlocked = await rejected(() =>
          journal.archiveDamaged("101:new"),
        );
        crypto.randomUUID = randomUUID;
        const afterCollision = await all();
        await journal.archiveDamaged("101:new");
        await journal.archiveDamaged("101:11");
        const archived = await all();
        const copy = archived.find(
          (entry) =>
            entry.key.startsWith("recovery:101:") &&
            (entry.value as { originalKey?: string })?.originalKey ===
              "101:new",
        )!.value as { originalKey: string; record: typeof bad };
        // A previously damaged slot repaired by another tab is never archived.
        await put("101:10", {
          ...valid,
          snapshot: { ...snapshot, editingId: 10 },
        });
        const replacedBlocked = await rejected(() =>
          journal.archiveDamaged("101:10"),
        );
        const foreignBlocked = await rejected(() =>
          journal.archiveDamaged("102:new"),
        );
        setPersonalDataOwner(102);
        const ownerBlocked = await rejected(() =>
          journal.archiveDamaged("101:9"),
        );
        const otherInspection = await new ArticleDraftJournal(102).inspect();
        setPersonalDataOwner(101);
        const final = await journal.inspect();
        const remaining = await all();
        database.close();
        return {
          inspection: {
            ids: inspection.records.map((record) => record.snapshot.editingId),
            damaged: inspection.damaged,
          },
          blockedWrite,
          blockedUndefined,
          blockedClear,
          quotaBlocked,
          deleteBlocked,
          collisionBlocked,
          quotaPreserved: afterQuota.some((entry) => entry.key === "101:new"),
          deletePreserved: afterDeleteFailure.some(
            (entry) => entry.key === "101:new",
          ),
          deleteRolledBack: !afterDeleteFailure.some((entry) =>
            entry.key.startsWith("recovery:"),
          ),
          collisionPreserved: afterCollision.some(
            (entry) => entry.key === "101:new",
          ),
          copy: {
            originalKey: copy.originalKey,
            snapshot: copy.record.snapshot,
            extra: copy.record.unknownField,
            bytes: await copy.record.files[0].file.text(),
            name: copy.record.files[0].file.name,
            modified: copy.record.files[0].file.lastModified,
          },
          undefinedArchived: archived.some(
            (entry) =>
              entry.key.startsWith("recovery:") &&
              (entry.value as { originalKey?: string })?.originalKey ===
                "101:11",
          ),
          replacedBlocked,
          foreignBlocked,
          ownerBlocked,
          otherInspection,
          finalIds: final.records.map((record) => record.snapshot.editingId),
          finalDamaged: final.damaged,
          foreignPreserved: remaining.some((entry) => entry.key === "102:new"),
        };
      });
      expect(result.inspection).toEqual({
        ids: [9],
        damaged: [{ key: "101:10" }, { key: "101:11" }, { key: "101:new" }],
      });
      for (const key of [
        "blockedWrite",
        "blockedUndefined",
        "blockedClear",
        "quotaBlocked",
        "deleteBlocked",
        "collisionBlocked",
        "quotaPreserved",
        "deletePreserved",
        "deleteRolledBack",
        "collisionPreserved",
        "undefinedArchived",
        "replacedBlocked",
        "foreignBlocked",
        "ownerBlocked",
        "foreignPreserved",
      ] as const)
        expect(result[key], key).toBe(true);
      expect(result.copy).toEqual({
        originalKey: "101:new",
        snapshot: {
          editingId: null,
          title: "Keep original",
          sections: "damaged",
        },
        extra: { keep: true },
        bytes: "original private bytes",
        name: "original.txt",
        modified: 123456,
      });
      expect(result.otherInspection).toEqual({
        records: [],
        damaged: [{ key: "102:new" }],
      });
      expect(result.finalIds.sort()).toEqual([10, 9]);
      expect(result.finalDamaged).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  20000,
);
