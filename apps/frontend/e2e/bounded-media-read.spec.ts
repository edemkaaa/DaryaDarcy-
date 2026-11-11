import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { resolve } from "node:path";

// Real browser stream/Blob/cancellation APIs; no backend, storage or UI replacements.
const script = buildSync({
  entryPoints: [resolve("src/shared/browser/file-operations.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "FileOperations",
  write: false,
}).outputFiles[0].text;
type BrowserReader = {
  FileOperations: {
    readResponseBlob(
      response: Response,
      limit: number,
      signal?: AbortSignal,
    ): Promise<Blob>;
  };
};
/** Каждый случай получает чистый документ и собранный исходный reader; stream/Blob остаются настоящими API браузера. */
test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  await page.addScriptTag({ content: script });
});

/** Проверяем переполнение как без Content-Length, так и с заведомо неверным маленьким значением; важен фактический поток. */
for (const length of [null, "1"]) {
  test(`bounds a streamed body with Content-Length=${length}`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (header) => {
      let produced = 0,
        cancelled = false;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            produced++;
            controller.enqueue(new Uint8Array([1, 2, 3, 4]));
            if (produced === 10) controller.close();
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 },
      );
      const response = new Response(body, {
        headers: header ? { "Content-Length": header } : {},
      });
      let rejected = false;
      try {
        await (
          window as unknown as BrowserReader
        ).FileOperations.readResponseBlob(response, 8);
      } catch {
        rejected = true;
      }
      return { produced, cancelled, rejected, locked: response.body!.locked };
    }, length);
    expect(result).toEqual({
      produced: 3,
      cancelled: true,
      rejected: true,
      locked: false,
    });
  });
}
/** Граничный размер должен сохранять исходные байты и MIME без ложного отказа. */
test("preserves an exact-limit document in the browser", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const response = new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: { "Content-Type": "application/pdf" },
    });
    const blob = await (
      window as unknown as BrowserReader
    ).FileOperations.readResponseBlob(response, 4);
    return {
      bytes: [...new Uint8Array(await blob.arrayBuffer())],
      type: blob.type,
    };
  });
  expect(result).toEqual({ bytes: [1, 2, 3, 4], type: "application/pdf" });
});
/** Отмена зависшего потока обязана отменить reader и освободить блокировку, не возвращая частичный файл. */
test("cancels a stalled browser stream without returning a partial file", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const controller = new AbortController();
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    );
    const reading = (
      window as unknown as BrowserReader
    ).FileOperations.readResponseBlob(response, 8, controller.signal);
    controller.abort(new Error("editor closed"));
    let message = "";
    try {
      await reading;
    } catch (error) {
      message = (error as Error).message;
    }
    return { message, cancelled, locked: response.body!.locked };
  });
  expect(result).toEqual({
    message: "editor closed",
    cancelled: true,
    locked: false,
  });
});
