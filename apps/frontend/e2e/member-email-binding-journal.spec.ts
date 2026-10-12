import { test, expect, type Page } from "@playwright/test";
import { buildSync } from "esbuild";
import type { MemberEmailBindingJournal } from "../src/features/admin/member-email-binding-journal";

declare global {
  interface Window {
    bindingJournalTest: {
      Journal: typeof MemberEmailBindingJournal;
      setOwner: (id: number | null) => void;
    };
  }
}
const bundle = buildSync({
  stdin: {
    contents: `export { MemberEmailBindingJournal as Journal } from "./src/features/admin/member-email-binding-journal";
    export { setPersonalDataOwner as setOwner } from "./src/shared/browser/storage";`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "iife",
  globalName: "bindingJournalTest",
  platform: "browser",
}).outputFiles[0].text;
async function open(page: Page) {
  await page.route("**/journal-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Local IndexedDB fixture</title>",
    }),
  );
  await page.goto("/journal-fixture");
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => window.bindingJournalTest.setOwner(101));
}

test("reservation survives reload with only version/key metadata and no draft payload", async ({
  page,
}) => {
  await open(page);
  const first = await page.evaluate(() =>
    new window.bindingJournalTest.Journal(101, 201).reserve(
      new AbortController().signal,
    ),
  );
  expect(first).toEqual({
    created: true,
    requestKey: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
  });
  await open(page);
  expect(
    await page.evaluate(() =>
      new window.bindingJournalTest.Journal(101, 201).load(
        new AbortController().signal,
      ),
    ),
  ).toBe(first.requestKey);
  const stored = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("darcy-member-email-intents", 1);
        request.onerror = () => reject(new Error("fixture open failed"));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("intents", "readonly");
          const read = tx.objectStore("intents").get("101:201");
          read.onsuccess = () => resolve(read.result);
          tx.oncomplete = () => db.close();
        };
      }),
  );
  expect(stored).toEqual({ version: 1, requestKey: first.requestKey });
});

test("two tabs atomically reserve one key; another member has an independent intent", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([open(page), open(other)]);
  const values = await Promise.all(
    [page, other].map((tab) =>
      tab.evaluate(() =>
        new window.bindingJournalTest.Journal(101, 201).reserve(
          new AbortController().signal,
        ),
      ),
    ),
  );
  expect(values.filter((value) => value.created)).toHaveLength(1);
  expect(values[0].requestKey).toBe(values[1].requestKey);
  const separate = await other.evaluate(() =>
    new window.bindingJournalTest.Journal(101, 202).reserve(
      new AbortController().signal,
    ),
  );
  expect(separate.requestKey).not.toBe(values[0].requestKey);
});

test("stale cleanup cannot delete a newer key", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const journal = new window.bindingJournalTest.Journal(101, 201);
    const signal = new AbortController().signal;
    const old = await journal.reserve(signal);
    const removed = await journal.release(old.requestKey, signal);
    const next = await journal.reserve(signal);
    const stale = await journal.release(old.requestKey, signal);
    return {
      removed,
      stale,
      old: old.requestKey,
      next: next.requestKey,
      current: await journal.load(signal),
    };
  });
  expect(result.removed).toBe(true);
  expect(result.stale).toBe(false);
  expect(result.next).not.toBe(result.old);
  expect(result.current).toBe(result.next);
});

test("a different actor cannot read, reserve or remove the previous actor's intent", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const api = window.bindingJournalTest;
    const journal = new api.Journal(101, 201);
    const signal = new AbortController().signal;
    const first = await journal.reserve(signal);
    api.setOwner(102);
    const refused = await Promise.all(
      [
        journal.load(signal),
        journal.reserve(signal),
        journal.release(first.requestKey, signal),
      ].map((promise) =>
        promise.then(
          () => false,
          () => true,
        ),
      ),
    );
    const other = await new api.Journal(102, 201).load(signal);
    api.setOwner(101);
    return {
      refused,
      other,
      restored: await journal.load(signal),
      key: first.requestKey,
    };
  });
  expect(result.refused).toEqual([true, true, true]);
  expect(result.other).toBeNull();
  expect(result.restored).toBe(result.key);
});

test("cancelled or invalid reservations fail before creating a recoverable intent", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const journal = new window.bindingJournalTest.Journal(101, 201);
    const abort = new AbortController();
    abort.abort();
    const cancelled = await journal.reserve(abort.signal).then(
      () => false,
      () => true,
    );
    const invalid = await new window.bindingJournalTest.Journal(101, 0)
      .reserve(new AbortController().signal)
      .then(
        () => false,
        () => true,
      );
    return {
      cancelled,
      invalid,
      stored: await journal.load(new AbortController().signal),
    };
  });
  expect(result).toEqual({ cancelled: true, invalid: true, stored: null });
});

test("storage denial fails closed without falling back to an unrecorded key", async ({
  page,
}) => {
  await open(page);
  const error = await page.evaluate(async () => {
    indexedDB.open = () => {
      throw new Error("PRIVATE_BROWSER_DETAILS");
    };
    return new window.bindingJournalTest.Journal(101, 201)
      .reserve(new AbortController().signal)
      .then(
        () => "accepted",
        (error) => String(error),
      );
  });
  expect(error).not.toBe("accepted");
  expect(error).not.toContain("PRIVATE_BROWSER_DETAILS");
});

test("corrupt metadata is refused without overwriting or deleting it", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const journal = new window.bindingJournalTest.Journal(101, 201);
    const signal = new AbortController().signal;
    const first = await journal.reserve(signal);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open("darcy-member-email-intents", 1);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(new Error("fixture open failed"));
    });
    const corrupt = { version: 2, requestKey: first.requestKey };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("intents", "readwrite");
      tx.objectStore("intents").put(corrupt, "101:201");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error("fixture write failed"));
    });
    const refused = await Promise.all(
      [
        journal.load(signal),
        journal.reserve(signal),
        journal.release(first.requestKey, signal),
      ].map((promise) =>
        promise.then(
          () => false,
          () => true,
        ),
      ),
    );
    const stored = await new Promise((resolve) => {
      const tx = db.transaction("intents", "readonly");
      const reading = tx.objectStore("intents").get("101:201");
      reading.onsuccess = () => resolve(reading.result);
      tx.oncomplete = () => db.close();
    });
    return { refused, stored, corrupt };
  });
  expect(result.refused).toEqual([true, true, true]);
  expect(result.stored).toEqual(result.corrupt);
});

test("cancellation or owner change while opening never commits an intent", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const api = window.bindingJournalTest;
    const journal = new api.Journal(101, 201);
    const controller = new AbortController();
    const cancelled = journal.reserve(controller.signal).then(
      () => false,
      () => true,
    );
    controller.abort();
    const switched = journal.reserve(new AbortController().signal).then(
      () => false,
      () => true,
    );
    api.setOwner(102);
    const refused = await Promise.all([cancelled, switched]);
    api.setOwner(101);
    return {
      refused,
      stored: await journal.load(new AbortController().signal),
    };
  });
  expect(result).toEqual({ refused: [true, true], stored: null });
});

test("write failure rolls back without reporting a durable reservation", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const journal = new window.bindingJournalTest.Journal(101, 201);
    const signal = new AbortController().signal;
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = () => {
      throw new Error("PRIVATE_QUOTA_DETAILS");
    };
    const error = await journal.reserve(signal).then(
      () => "accepted",
      (error) => String(error),
    );
    IDBObjectStore.prototype.add = original;
    return { error, stored: await journal.load(signal) };
  });
  expect(result.error).not.toBe("accepted");
  expect(result.error).not.toContain("PRIVATE_QUOTA_DETAILS");
  expect(result.stored).toBeNull();
});
