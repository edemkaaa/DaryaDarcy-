import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Адресуем ссылку конкретного retained-раздела по его app-маршруту. */
const tab = (page: Page, path: string) => page.locator(`nav a[href="${path}"]`);
/** Читаем только видимый вертикальный контейнер текущей панели. */
const scroll = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal):visible").first();

/** Снимаем первый содержательный кадр после capture-click: CSS раздела должен быть готов вместе с заголовком и книжной раскладкой. */
test("a newly opened tab has its layout styles in its first content frame", async ({
  page,
}) => {
  await layoutApi(page);
  await page.addInitScript(() => {
    const frames: Record<string, { fontSize: string; booksGap?: number }> = {};
    Object.assign(window, { firstTabFrames: frames });
    document.addEventListener(
      "click",
      (event) => {
        const link = (event.target as Element).closest("nav a[href]");
        const path = link?.getAttribute("href");
        const title = (
          {
            "/videos": "ВИДЕО",
            "/interactive": "ИНТЕРАКТИВ",
            "/library": "БИБЛИОТЕКА",
            "/shop": "МАГАЗИН",
          } as Record<string, string>
        )[path || ""];
        if (!path || !title) return;
        /** Ждём появления реального заголовка, исключая loading-copy, и сохраняем только первый подходящий кадр. */
        const sample = () => {
          const panel = document.querySelector(
            `main [data-tab-screen="${path}"]:not([hidden])`,
          );
          const text = [...(panel?.querySelectorAll(".ui-text") || [])].filter(
            (node) => !node.closest("[data-loading-screen]"),
          );
          const heading = text.find((node) => node.textContent === title);
          if (!heading) {
            requestAnimationFrame(sample);
            return;
          }
          const books = ["Книга Вдохновения", "Тропинка к Творчеству"].map(
            (label) => text.find((node) => node.textContent === label),
          );
          frames[path] = {
            fontSize: getComputedStyle(heading).fontSize,
            booksGap: books.every(Boolean)
              ? books[1]!.getBoundingClientRect().x -
                books[0]!.getBoundingClientRect().x
              : undefined,
          };
        };
        requestAnimationFrame(sample);
      },
      true,
    );
  });
  await gotoWithSession(page, "/");
  await page.evaluate(() => document.fonts.ready);
  for (const path of ["/videos", "/interactive", "/library", "/shop"]) {
    await tab(page, path).click();
    await expect
      .poll(() =>
        page.evaluate(
          (path) =>
            (
              window as unknown as {
                firstTabFrames: Record<string, { fontSize: string }>;
              }
            ).firstTabFrames[path]?.fontSize,
          path,
        ),
      )
      .toBe("28px");
  }
  const gap = await page.evaluate(
    () =>
      (
        window as unknown as {
          firstTabFrames: Record<string, { booksGap: number }>;
        }
      ).firstTabFrames["/shop"].booksGap,
  );
  expect(gap).toBeGreaterThan(50);
});

/** Наблюдаем нативные Element.animate и считаем входы узнаваемых заголовков, не заменяя анимации. */
async function observeEntrances(page: Page) {
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    const counts: Record<string, number> = {};
    Object.assign(window, { tabEntrances: counts });
    /** Пропускаем вызов в оригинальный animate после подсчёта, чтобы измерение не изменяло визуальное поведение. */
    Element.prototype.animate = function (frames, options) {
      for (const title of ["ВИДЕО", "ИНТЕРАКТИВ", "ТЕСТ-ПУТЕШЕСТВИЕ"]) {
        if (this.textContent?.includes(title))
          counts[title] = (counts[title] || 0) + 1;
      }
      return original.call(this, frames, options);
    };
  });
}

/** Шесть retained-вкладок сохраняют scroll/search и не повторяют анимации; detail-навигация также возвращает тот же поиск. */
for (const width of [390, 1440]) {
  test(`all six tabs preserve scroll and search and only animate on first entry (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    await observeEntrances(page);
    await gotoWithSession(page, "/library");
    // Next can briefly keep streamed HTML in a hidden S:0 container after
    // session startup. Wait for that copy to be consumed before filling.
    await expect(page.getByPlaceholder("Поиск материалов...")).toHaveCount(1);
    await page.getByPlaceholder("Поиск материалов...").fill("Сборник");
    await expect(
      page.getByText("Сборник стилизаций", { exact: true }),
    ).toBeVisible();
    await tab(page, "/club").click();
    await expect(
      page.getByRole("button", { name: "Оплатить 790 ₽", exact: true }).first(),
    ).toBeVisible();
    await scroll(page).evaluate((n) => {
      n.scrollTop = 600;
      Object.assign(window, { savedClubScroll: n });
    });
    await tab(page, "/videos").click();
    await expect(page.getByText("ВИДЕО", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { tabEntrances: Record<string, number> })
              .tabEntrances["ВИДЕО"],
        ),
      )
      .toBe(1);
    await tab(page, "/interactive").click();
    await expect(page.getByText("ИНТЕРАКТИВ", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { tabEntrances: Record<string, number> })
              .tabEntrances["ИНТЕРАКТИВ"],
        ),
      )
      .toBe(1);
    await tab(page, "/feed").click();
    await expect(page.getByPlaceholder("Поиск...")).toBeVisible();
    await tab(page, "/shop").click();
    await expect(page.getByText("МАГАЗИН", { exact: true })).toBeVisible();
    await tab(page, "/club").click();
    await expect
      .poll(() => scroll(page).evaluate((n) => n.scrollTop))
      .toBe(600);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { savedClubScroll: HTMLElement })
            .savedClubScroll.isConnected,
      ),
    ).toBe(true);
    await tab(page, "/library").click();
    await expect(page.getByPlaceholder("Поиск материалов...")).toHaveValue(
      "Сборник",
    );
    await tab(page, "/videos").click();
    await expect(page.getByText("ВИДЕО", { exact: true })).toBeVisible();
    await tab(page, "/interactive").click();
    await expect(page.getByText("ИНТЕРАКТИВ", { exact: true })).toBeVisible();
    const counts = await page.evaluate(
      () =>
        (window as unknown as { tabEntrances: Record<string, number> })
          .tabEntrances,
    );
    expect(counts).toEqual({ ВИДЕО: 1, ИНТЕРАКТИВ: 1, "ТЕСТ-ПУТЕШЕСТВИЕ": 1 });
    // The retained library also survives leaving the bottom tabs for a detail.
    await tab(page, "/library").click();
    await page.getByPlaceholder("Поиск материалов...").fill("Обо мне");
    await page.getByRole("button", { name: "Читать →", exact: true }).click();
    await expect(page).toHaveURL(/\/library\/about-me$/);
    await page
      .locator("header")
      .getByRole("button", { name: "Вернуться назад", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByPlaceholder("Поиск материалов...")).toHaveValue(
      "Обо мне",
    );
  });
}

/** Задержка API не двигает статические заголовок и карточки библиотеки при замене placeholder данными. */
test("video heading and static library cards stay in place while API requests finish", async ({
  page,
}) => {
  await layoutApi(page);
  let finish: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/trpc/**", async (route) => {
    if (
      /videos\.list|articles\.list/.test(
        decodeURIComponent(route.request().url()),
      )
    )
      await blocked;
    await route.fallback();
  });
  await gotoWithSession(page, "/videos");
  const title = page.getByText("ВИДЕО", { exact: true });
  await expect(title).toBeVisible();
  await expect(
    page.locator('[data-content-placeholder="video"]'),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const beforeVideo = await title.boundingBox();
  await tab(page, "/library").click();
  const card = page.getByRole("button", {
    name: "Открыть материал: Гид по эстетикам",
    exact: true,
  });
  await expect(card).toBeVisible();
  const beforeCard = await card.boundingBox();
  finish?.();
  await expect(
    page.locator('[data-content-placeholder="library"]'),
  ).toHaveCount(0);
  expect(await card.boundingBox()).toEqual(beforeCard);
  await tab(page, "/videos").click();
  await expect.poll(() => title.boundingBox()).toEqual(beforeVideo);
});

/** Возврат к устаревшей панели обновляет данные в фоне, сохраняя поиск и подтверждённые карточки до ответа. */
test("returning to a stale tab refreshes the API without clearing its search or cached cards", async ({
  page,
}) => {
  await layoutApi(page);
  await page.clock.install();
  let calls = 0;
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/trpc/articles.list**", async (route) => {
    calls++;
    if (calls === 1) return route.fallback();
    await held;
    await route.fulfill({
      json: [
        {
          result: {
            data: {
              json: [
                {
                  id: 701,
                  title: "Сборник обновления",
                  coverUrl: null,
                  access: "public",
                },
              ],
            },
          },
        },
      ],
    });
  });
  try {
    await gotoWithSession(page, "/library");
    await expect(page.locator("main .ui-spinner")).toHaveCount(0);
    await page.getByPlaceholder("Поиск материалов...").fill("Сборник");
    await tab(page, "/videos").click();
    await expect(page.getByText("ВИДЕО", { exact: true })).toBeVisible();
    await page.clock.fastForward(31_000);
    expect(calls).toBe(1);
    await tab(page, "/library").click();
    await expect.poll(() => calls).toBe(2);
    await expect(page.getByPlaceholder("Поиск материалов...")).toHaveValue(
      "Сборник",
    );
    await expect(
      page.getByText("Сборник стилизаций", { exact: true }),
    ).toBeVisible();
    finish();
    await expect(
      page.getByText("Сборник обновления", { exact: true }),
    ).toBeVisible();
  } finally {
    finish();
  }
});

/** Скрытый клуб не обрабатывает paid-флаг другого URL; подтверждённая смена сессии сбрасывает retained-персональное состояние. */
test("a hidden club never processes another page's paid flag and retained state clears on session change", async ({
  page,
}) => {
  await layoutApi(page, true);
  let claims = 0;
  await page.route("**/api/trpc/club.claimPending**", (route) => {
    claims++;
    return route.fulfill({
      json: { result: { data: { json: { granted: false } } } },
    });
  });
  await gotoWithSession(page, "/club");
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await tab(page, "/library").click();
  await page.getByPlaceholder("Поиск материалов...").fill("Сборник");
  await page.evaluate(() => history.pushState(null, "", "/library?paid=1"));
  await expect(page).toHaveURL(/\/library$/);
  expect(claims).toBe(0);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  const response = page.waitForResponse("**/api/auth/me");
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", { key: "darcy:session-change" }),
    ),
  );
  await response;
  await expect(page.getByPlaceholder("Поиск материалов...")).toHaveValue("");
  expect(claims).toBe(0);
  await tab(page, "/club").click();
  await expect(
    page.getByRole("button", { name: "Оплатить 790 ₽", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть фильтры клуба" }),
  ).toHaveCount(0);
});
