import { expect, test } from "@playwright/test";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

declare global {
  interface Window {
    draftCheckpointTest: {
      holdCommit: boolean;
      holdAutosave: boolean;
      releaseCommit: (() => void) | null;
      releaseAutosave: (() => void) | null;
    };
  }
}

/** В полном и быстром редакторе задерживаем два разных этапа автосохранения, чтобы поздний commit старой версии не пометил новый ввод сохранённым. */
for (const mode of ["full", "quick"] as const) {
  test(`${mode}: an older completed checkpoint cannot mark newer text saved`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const controls = (window.draftCheckpointTest = {
        holdCommit: false,
        holdAutosave: false,
        releaseCommit: null as (() => void) | null,
        releaseAutosave: null as (() => void) | null,
      });
      const descriptor = Object.getOwnPropertyDescriptor(
        IDBTransaction.prototype,
        "oncomplete",
      )!;
      Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
        ...descriptor,
        /** Перехватываем только уведомление завершения readwrite-транзакции, сохраняя настоящую запись IndexedDB. */
        set(handler: ((this: IDBTransaction, event: Event) => unknown) | null) {
          const transaction = this as IDBTransaction;
          descriptor.set!.call(transaction, function (event: Event) {
            /** Сохраняем исходный обработчик и его transaction-this для управляемого позднего завершения. */
            const complete = () => handler?.call(transaction, event);
            if (transaction.mode === "readwrite" && controls.holdCommit) {
              controls.holdCommit = false;
              controls.releaseCommit = complete;
            } else complete();
          });
        },
      });
      const timeout = window.setTimeout.bind(window);
      window.setTimeout = ((
        callback: TimerHandler,
        delay?: number,
        ...args: unknown[]
      ) => {
        if (
          controls.holdAutosave &&
          delay === 250 &&
          typeof callback === "function"
        ) {
          const timer = timeout(() => {}, 60_000);
          controls.releaseAutosave = () => {
            clearTimeout(timer);
            callback(...args);
          };
          return timer;
        }
        return timeout(callback, delay, ...args);
      }) as typeof window.setTimeout;
    });
    await editorApi(page);
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    await page
      .getByRole("button", {
        name: "Новый пост",
        exact: true,
      })
      .click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    const saved = form.getByText("Черновик сохранён на этом устройстве", {
      exact: true,
    });
    const saving = form.getByText("Сохраняем черновик…", { exact: true });
    const field = form.getByPlaceholder("Текст поста… Enter — новый абзац");
    await expect(saved).toBeVisible();
    await page.evaluate(() => {
      window.draftCheckpointTest.holdCommit = true;
    });
    await field.fill("FIRST_DURABLE_VERSION");
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(window.draftCheckpointTest.releaseCommit)),
      )
      .toBe(true);
    await page.evaluate(() => {
      window.draftCheckpointTest.holdAutosave = true;
    });
    await field.fill("SECOND_UNSAVED_VERSION");
    await expect(saving).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(window.draftCheckpointTest.releaseAutosave),
        ),
      )
      .toBe(true);
    await page.evaluate(() => window.draftCheckpointTest.releaseCommit!());
    // Reading IndexedDB yields past the completion callback/React update and
    // proves the durable version still differs from the visible editor.
    /** Читаем фактически зафиксированный текст отдельной readonly-транзакцией и закрываем соединение по её завершении. */
    const storedText = async () =>
      page.evaluate(
        (key) =>
          new Promise<string>((resolve, reject) => {
            const request = indexedDB.open("darcy-post-drafts", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction("drafts", "readonly");
              const draft = transaction.objectStore("drafts").get(key);
              draft.onsuccess = () =>
                resolve(draft.result?.editor?.draft?.text ?? "");
              transaction.oncomplete = () => db.close();
              transaction.onerror = () => reject(transaction.error);
            };
          }),
        mode === "full" ? "101:full:new" : "101:quick:new:feed",
      );
    expect(await storedText()).toBe("FIRST_DURABLE_VERSION");
    await expect(saving).toBeVisible();
    await expect(saved).toHaveCount(0);
    await page.evaluate(() => {
      window.draftCheckpointTest.holdAutosave = false;
      window.draftCheckpointTest.releaseAutosave!();
    });
    await expect(saved).toBeVisible();
    expect(await storedText()).toBe("SECOND_UNSAVED_VERSION");
  });
}
