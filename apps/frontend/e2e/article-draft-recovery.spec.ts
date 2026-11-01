import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const recover = (page: Page) =>
  page.getByRole("button", {
    name: "Восстановить редактор",
    exact: true,
  });
const retryRead = (page: Page) =>
  page.getByRole("button", {
    name: "Повторить",
    exact: true,
  });
const create = (page: Page) =>
  page.getByRole("button", { name: "Написать статью", exact: true });
const title = (page: Page) => page.getByPlaceholder("Что посмотреть осенью...");
const restore = (page: Page) =>
  page.getByRole("button", { name: "Продолжить черновик статьи", exact: true });

async function fixture(page: Page) {
  const writes: string[] = [];
  await editorApi(page, (name) => {
    if (/^admin\.(createArticle|updateArticle|deleteArticle|upload)/.test(name))
      writes.push(name);
    if (name === "admin.articles")
      return ok(
        [9, 10].map((id) => ({
          id,
          title: `Server article ${id}`,
          coverUrl: null,
          access: "club",
          published: false,
          sections: [{ type: "text", text: "Server content" }],
          editRevision: `server-revision:${id}`,
        })),
      );
  });
  return writes;
}
async function seed(
  page: Page,
  badSlot: number | null,
  validSlot?: number | null,
) {
  await page.evaluate(
    async ({ badSlot, validSlot }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("darcy-article-drafts", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("drafts");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        const store = tx.objectStore("drafts");
        store.put(
          {
            version: 1,
            ownerId: 101,
            revision: "broken-original",
            snapshot: {
              editingId: badSlot,
              title: "Damaged original title",
              sections: "broken",
            },
            files: [
              {
                file: new File(["original private document"], "original.txt", {
                  type: "text/plain",
                }),
              },
            ],
          },
          `101:${badSlot ?? "new"}`,
        );
        if (validSlot !== undefined)
          store.put(
            {
              version: 1,
              ownerId: 101,
              revision: "valid-original",
              snapshot: {
                editingId: validSlot,
                title: "HEALTHY_DRAFT",
                access: "club",
                published: false,
                coverUrl: null,
                sections: [{ type: "text", text: "Saved content" }],
              },
              files: [],
            },
            `101:${validSlot ?? "new"}`,
          );
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { badSlot, validSlot },
  );
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    type Entry = {
      originalKey?: string;
      record?: Entry;
      snapshot?: { title?: string };
      files?: { file: File }[];
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("darcy-article-drafts", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const entries = await new Promise<{ key: string; value: Entry }[]>(
      (resolve, reject) => {
        const tx = db.transaction("drafts");
        const entries: { key: string; value: Entry }[] = [];
        const read = tx.objectStore("drafts").openCursor();
        read.onsuccess = () => {
          const cursor = read.result;
          if (cursor) {
            entries.push({ key: String(cursor.key), value: cursor.value });
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve(entries);
        tx.onabort = () => reject(tx.error);
      },
    );
    db.close();
    return {
      keys: entries.map((entry) => entry.key),
      drafts: entries
        .filter((entry) => entry.key.startsWith("101:"))
        .map((entry) => ({
          key: entry.key,
          title: entry.value.snapshot?.title,
        })),
      backups: await Promise.all(
        entries
          .filter((entry) => entry.key.startsWith("recovery:101:"))
          .map(async (entry) => ({
            originalKey: entry.value.originalKey,
            title: entry.value.record?.snapshot?.title,
            text: await entry.value.record?.files?.[0]?.file.text(),
          })),
      ),
    };
  });
}
async function openArticles(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
}

test("a damaged new draft leaves healthy drafts usable and is archived with original file bytes only after confirmation", async ({
  page,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, null, 9);
  await openArticles(page);
  await expect(recover(page)).toBeVisible();
  await expect(create(page)).toBeDisabled();
  await restore(page).click();
  await expect(title(page)).toHaveValue("HEALTHY_DRAFT");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await recover(page).click();
  expect((await stored(page)).keys).toContain("101:new");
  expect((await stored(page)).backups).toEqual([]);
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(create(page)).toBeEnabled();
  await expect(recover(page)).toHaveCount(0);
  expect((await stored(page)).backups).toEqual([
    {
      originalKey: "101:new",
      title: "Damaged original title",
      text: "original private document",
    },
  ]);
  await openArticles(page);
  await expect(create(page)).toBeEnabled();
  expect((await stored(page)).backups).toHaveLength(1);
  await create(page).click();
  await title(page).fill("NEW_LOCAL_DRAFT");
  await expect
    .poll(
      async () =>
        (await stored(page)).drafts.find((entry) => entry.key === "101:new")
          ?.title,
    )
    .toBe("NEW_LOCAL_DRAFT");
  expect((await stored(page)).backups[0].text).toBe(
    "original private document",
  );
  expect(writes).toEqual([]);
});

test("a damaged edit blocks only that article and the server article can be opened after archiving", async ({
  page,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, 9, null);
  await openArticles(page);
  const edit = page.getByRole("button", { name: "Править", exact: true });
  await expect(edit.nth(0)).toBeDisabled();
  await expect(edit.nth(1)).toBeEnabled();
  await expect(create(page)).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(edit.nth(0)).toBeEnabled();
  await edit.nth(0).click();
  await expect(title(page)).toHaveValue("Server article 9");
  expect((await stored(page)).backups[0]).toEqual({
    originalKey: "101:9",
    title: "Damaged original title",
    text: "original private document",
  });
  expect(
    (await stored(page)).drafts.find((entry) => entry.key === "101:new")?.title,
  ).toBe("HEALTHY_DRAFT");
  expect(writes).toEqual([]);
});

test("a failed backup leaves the original draft locked and can be retried", async ({
  page,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, null);
  await openArticles(page);
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    Object.assign(window, { failDraftBackup: true });
    IDBObjectStore.prototype.add = function (...args) {
      if (
        this.transaction.db.name === "darcy-article-drafts" &&
        (window as unknown as { failDraftBackup: boolean }).failDraftBackup
      )
        throw new DOMException("Full", "QuotaExceededError");
      return add.apply(this, args);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Не удалось сохранить или прочитать черновик" }),
  ).toBeVisible();
  await expect(create(page)).toBeDisabled();
  expect((await stored(page)).keys).toContain("101:new");
  expect((await stored(page)).backups).toHaveLength(0);
  await page.evaluate(() => Object.assign(window, { failDraftBackup: false }));
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(create(page)).toBeEnabled();
  expect((await stored(page)).backups[0].text).toBe(
    "original private document",
  );
  expect(writes).toEqual([]);
});

test("a valid replacement from another tab is preserved and can be discovered without reloading the page", async ({
  page,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, null);
  await openArticles(page);
  await expect(recover(page)).toBeVisible();
  await seed(page, 9, null); // Replace the damaged new slot with a healthy record.
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "уже восстановлен в другой вкладке" }),
  ).toBeVisible();
  expect((await stored(page)).backups).toHaveLength(0);
  expect(
    (await stored(page)).drafts.find((entry) => entry.key === "101:new")?.title,
  ).toBe("HEALTHY_DRAFT");
  await retryRead(page).click();
  await expect(create(page)).toBeEnabled();
  await restore(page).click();
  await expect(title(page)).toHaveValue("HEALTHY_DRAFT");
  expect(writes).toEqual([]);
});

test("an initial IndexedDB read failure can be retried and does not require deleting data", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    Object.assign(window, { failDraftRead: true });
    indexedDB.open = ((...args: Parameters<IDBFactory["open"]>) => {
      if (
        args[0] === "darcy-article-drafts" &&
        (window as unknown as { failDraftRead: boolean }).failDraftRead
      )
        throw new DOMException("Denied", "SecurityError");
      return open(...args);
    }) as IDBFactory["open"];
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(retryRead(page)).toBeVisible();
  await expect(create(page)).toBeDisabled();
  await expect(recover(page)).toHaveCount(0);
  await page.evaluate(() => Object.assign(window, { failDraftRead: false }));
  await retryRead(page).click();
  await expect(create(page)).toBeEnabled();
  await create(page).click();
  await expect(title(page)).toHaveValue("");
  expect(writes).toEqual([]);
});

test("a failed refresh after archiving preserves the backup and a read retry unlocks the editor", async ({
  page,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, null);
  await openArticles(page);
  await expect(recover(page)).toBeVisible();
  await page.evaluate(() => {
    const open = indexedDB.open.bind(indexedDB);
    let draftReads = 0;
    Object.assign(window, { failDraftRefresh: true });
    indexedDB.open = ((...args: Parameters<IDBFactory["open"]>) => {
      if (
        args[0] === "darcy-article-drafts" &&
        ++draftReads === 2 &&
        (window as unknown as { failDraftRefresh: boolean }).failDraftRefresh
      )
        throw new DOMException("Denied", "SecurityError");
      return open(...args);
    }) as IDBFactory["open"];
  });
  page.once("dialog", (dialog) => dialog.accept());
  await recover(page).click();
  await expect(page.locator("[data-background-notice]")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(
    page
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Не удалось прочитать черновики" }),
  ).toBeVisible();
  await expect(
    page.getByText("Не удалось прочитать черновики на этом устройстве.", {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(recover(page)).toHaveCount(0);
  const saved = await stored(page);
  expect(saved.keys).not.toContain("101:new");
  expect(saved.backups).toEqual([
    {
      originalKey: "101:new",
      title: "Damaged original title",
      text: "original private document",
    },
  ]);
  await retryRead(page).click();
  await expect(create(page)).toBeEnabled();
  await expect(recover(page)).toHaveCount(0);
  expect((await stored(page)).backups).toHaveLength(1);
  expect(writes).toEqual([]);
});

test("two tabs cannot archive the same damaged draft twice or lose its file", async ({
  page,
  context,
}) => {
  const writes = await fixture(page);
  await gotoWithSession(page, "/admin");
  await seed(page, null);
  await openArticles(page);
  const other = await context.newPage();
  const otherWrites = await fixture(other);
  await gotoWithSession(other, "/admin");
  await other.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(recover(other)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  other.once("dialog", (dialog) => dialog.accept());
  await Promise.all([recover(page).click(), recover(other).click()]);
  await expect.poll(async () => (await stored(page)).backups.length).toBe(1);
  await expect
    .poll(
      async () =>
        Number(await create(page).isEnabled()) +
        Number(await create(other).isEnabled()),
    )
    .toBe(1);
  const loser = (await create(page).isEnabled()) ? other : page;
  await expect(
    loser
      .locator("[data-background-notice] [role=status]")
      .filter({ hasText: "Черновик уже изменился" }),
  ).toBeVisible();
  await retryRead(loser).click();
  await expect(create(page)).toBeEnabled();
  await expect(create(other)).toBeEnabled();
  expect((await stored(page)).backups).toEqual([
    {
      originalKey: "101:new",
      title: "Damaged original title",
      text: "original private document",
    },
  ]);
  expect(writes).toEqual([]);
  expect(otherWrites).toEqual([]);
});
