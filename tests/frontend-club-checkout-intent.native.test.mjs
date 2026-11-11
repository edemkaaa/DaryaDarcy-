import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
const selection = { email: "buyer@example.test" };
let browser, server, origin;

/** Собирает настоящий browser helper, поднимает локальный origin и запускает Chromium для проверки реальных Web Locks. */
before(async () => {
  // Serve the real production helper, not a test implementation or app route.
  const bundle = await build({
    entryPoints: [
      new URL(
        "../apps/frontend/src/features/club/checkout-intent.ts",
        import.meta.url,
      ).pathname,
    ],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
  });
  server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/intent.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        "<!doctype html><title>Local checkout intent acceptance</title>",
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
});
/** Закрывает только собственный браузер и локальный HTTP-сервер набора. */
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

/** Открывает две вкладки одного браузерного контекста, чтобы они разделяли localStorage и блокировки origin. */
async function pages() {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto(origin), second.goto(origin)]);
  return { context, first, second };
}
/** Вызывает реальное создание checkout intent внутри вкладки без подмены Web Locks. */
const intent = (page, input = selection) =>
  page.evaluate(async (input) => {
    const { getClubCheckoutIntent } = await import("/intent.js");
    return getClubCheckoutIntent(input);
  }, input);

/** Проверяет восстановление сохранённого intent после reload и отказ от перезаписи повреждённого свидетельства. */
test("read-only return recovers a reloaded tab without creating or replacing evidence", async () => {
  const { context, first, second } = await pages();
  /** Читает сохранённый intent из реального браузерного storage без создания нового ключа. */
  const read = (page) =>
    page.evaluate(async () => {
      const { readSavedClubCheckoutIntent } = await import("/intent.js");
      return readSavedClubCheckoutIntent();
    });
  try {
    assert.equal(await read(second), null);
    const saved = await intent(first);
    const prior = await first.evaluate(
      (key) => localStorage.getItem(key),
      storageKey,
    );
    await second.reload();
    assert.deepEqual(await read(second), {
      idempotencyKey: saved.idempotencyKey,
    });
    assert.equal(
      await second.evaluate((key) => localStorage.getItem(key), storageKey),
      prior,
    );
    await first.evaluate(
      (key) => localStorage.setItem(key, "corrupt"),
      storageKey,
    );
    await assert.rejects(read(second), /Сохранённую заявку/);
    assert.equal(
      await second.evaluate((key) => localStorage.getItem(key), storageKey),
      "corrupt",
    );
  } finally {
    await context.close();
  }
});

/** Удерживает настоящую Web Lock, дожидается двух претендентов и проверяет единственный UUID после reload. */
test(
  "two tabs queue behind a real Web Lock and recover one durable UUID after reload",
  { timeout: 15_000 },
  async () => {
    const { context, first, second } = await pages();
    try {
      assert.equal(await first.evaluate(() => isSecureContext), true);
      await first.evaluate(
        (name) =>
          new Promise((started) => {
            navigator.locks.request(
              name,
              () =>
                new Promise((release) => {
                  window.releaseCheckoutTestLock = release;
                  started();
                }),
            );
          }),
        storageKey,
      );
      const pending = Promise.allSettled([intent(first), intent(second)]);
      // A missing exclusive lock must fail this check, even if a lucky race
      // happened to read the same record.
      let queued = 0;
      for (let attempt = 0; attempt < 100 && queued < 2; attempt++) {
        queued = await first.evaluate(
          async (name) =>
            (await navigator.locks.query()).pending.filter(
              (lock) => lock.name === name,
            ).length,
          storageKey,
        );
        if (queued < 2) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(queued, 2);
      assert.deepEqual(
        await first.evaluate(
          async (name) =>
            (await navigator.locks.query()).pending
              .filter((lock) => lock.name === name)
              .map((lock) => lock.mode),
          storageKey,
        ),
        ["exclusive", "exclusive"],
      );
      await first.evaluate(() => window.releaseCheckoutTestLock());
      const [firstResult, secondResult] = await pending;
      assert.equal(firstResult.status, "fulfilled");
      assert.equal(secondResult.status, "fulfilled");
      const one = firstResult.value;
      const two = secondResult.value;
      assert.deepEqual(one, two);
      await second.reload();
      assert.deepEqual(
        await intent(second, {
          email: " BUYER@EXAMPLE.TEST ",
          plan: "monthly",
        }),
        one,
      );
      const saved = await first.evaluate(
        (key) => localStorage.getItem(key),
        storageKey,
      );
      assert.equal(JSON.parse(saved).idempotencyKey, one.idempotencyKey);
      assert.ok(!saved.includes(selection.email));
    } finally {
      await context.close();
    }
  },
);

/** Проверяет запрет второй вкладке менять незавершённый выбор или исправлять повреждённый журнал вслепую. */
test(
  "another tab cannot replace an unresolved selection or corrupt evidence",
  { timeout: 15_000 },
  async () => {
    const { context, first, second } = await pages();
    try {
      const one = await intent(first);
      await assert.rejects(
        intent(second, { email: "other@example.test" }),
        /предыдущую покупку/,
      );
      assert.deepEqual(await intent(first), one);
      await first.evaluate(
        (key) => localStorage.setItem(key, "corrupt evidence"),
        storageKey,
      );
      await assert.rejects(intent(second), /Сохранённую заявку/);
      assert.equal(
        await first.evaluate((key) => localStorage.getItem(key), storageKey),
        "corrupt evidence",
      );
    } finally {
      await context.close();
    }
  },
);

/** Проверяет настоящий таймаут ожидающей блокировки и возможность последующего повтора с прежним intent. */
test(
  "a genuine lock timeout refuses an intent and leaves retry possible with the same record",
  { timeout: 15_000 },
  async () => {
    const { context, first, second } = await pages();
    try {
      const prior = await intent(first);
      await first.evaluate(
        (name) =>
          new Promise((started) => {
            navigator.locks.request(
              name,
              () =>
                new Promise((release) => {
                  window.releaseCheckoutTestLock = release;
                  started();
                }),
            );
          }),
        storageKey,
      );
      await assert.rejects(intent(second), /Браузер не может/);
      assert.equal(
        await second.evaluate(
          async () => (await navigator.locks.query()).pending.length,
        ),
        0,
      );
      await first.evaluate(() => window.releaseCheckoutTestLock());
      assert.deepEqual(await intent(second), prior);
    } finally {
      await context.close();
    }
  },
);
