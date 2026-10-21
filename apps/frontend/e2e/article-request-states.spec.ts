import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

type Outcome = "success" | "network" | "missing" | "locked" | 403 | 404 | 500;
const title = "Статья для проверки повторного чтения";
const originalText = "Прежний текст статьи";
const recoveredText = "Содержание после успешного повтора";
const photo = "https://article.example.test/original.png";
const recoveredPhoto = "https://article.example.test/recovered.png";
const viewer = (page: Page) =>
  page.getByRole("dialog", { name: "Просмотр фотографий", exact: true });

async function articleApi(page: Page) {
  await layoutApi(page, true);
  await page.route("https://article.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#8b7355"/></svg>',
    }),
  );
  let outcome: Outcome = "success";
  let recovered = false;
  let reads = 0;
  let gate = Promise.resolve();
  const releases = new Set<() => void>();
  const article = () => ({
    id: 700,
    title,
    access: "public",
    coverUrl: null,
    published: true,
    locked: false,
    sections: [
      { type: "text", text: recovered ? recoveredText : originalText },
      { type: "photo", url: recovered ? recoveredPhoto : photo },
    ],
  });
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    if (!names.some((name) => name.startsWith("articles.")))
      return route.fallback();
    const reading = names.includes("articles.getById");
    const responseOutcome = outcome;
    const snapshot = article();
    if (reading) {
      reads++;
      await gate;
      if (responseOutcome === "network")
        return route.abort("internetdisconnected");
    }
    const results = names.map((name) => {
      if (name === "articles.list") return ok([snapshot]);
      if (name === "articles.getById") {
        if (typeof responseOutcome === "number")
          return {
            error: {
              json: {
                message: "PRIVATE_INTERNAL_DETAILS",
                code: -32603,
                data: {
                  code:
                    responseOutcome === 403
                      ? "FORBIDDEN"
                      : responseOutcome === 404
                        ? "NOT_FOUND"
                        : "INTERNAL_SERVER_ERROR",
                  httpStatus: responseOutcome,
                },
              },
            },
          };
        if (responseOutcome === "missing") return ok(null);
        return ok({ ...snapshot, locked: responseOutcome === "locked" });
      }
      // Preserve unrelated procedures when tRPC batches the article with access checks.
      if (name === "club.subscription")
        return ok({
          hasClubAccess: true,
          subscribed: true,
          expiresAt: "2040-11-01T10:00:00Z",
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: false,
          monthlyPrice: "790",
        });
      if (name === "feed.userInteractions")
        return ok({ likedIds: [], savedIds: [] });
      return ok([]);
    });
    return route.fulfill({
      json: url.searchParams.get("batch") === "1" ? results : results[0],
    });
  });
  return {
    get reads() {
      return reads;
    },
    setOutcome(value: Outcome) {
      outcome = value;
      if (value === "success") recovered = true;
    },
    hold() {
      let resume!: () => void;
      gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const release = () => {
        releases.delete(release);
        resume();
      };
      releases.add(release);
      return release;
    },
    async cleanup() {
      for (const release of releases) release();
      await page.unrouteAll({ behavior: "wait" });
    },
  };
}

async function openCachedArticle(page: Page) {
  await gotoWithSession(page, "/library/article/700");
  await expect(page.getByText(originalText, { exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Библиотека", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Открыть материал: ${title}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.setFixedTime(
    new Date((await page.evaluate(() => Date.now())) + 60_000),
  );
}

for (const width of [320, 1440])
  for (const outcome of [403, 404, 500, "network"] as const)
    test(`article refetch ${outcome} hides cached content and closes photos at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const api = await articleApi(page);
      try {
        await openCachedArticle(page);
        api.setOutcome(outcome);
        const release = api.hold();
        await page
          .getByRole("button", {
            name: `Открыть материал: ${title}`,
            exact: true,
          })
          .click();
        await expect.poll(() => api.reads).toBeGreaterThan(1);
        // Open the previously confirmed photo while a real background read is pending.
        await page
          .getByRole("button", {
            name: "Открыть изображение статьи",
            exact: true,
          })
          .click();
        await expect(viewer(page)).toBeVisible();
        release();
        await expect(viewer(page)).toHaveCount(0);
        await expect(page.getByText(originalText, { exact: true })).toHaveCount(
          0,
        );
        await expect(page.locator(`main img[src="${photo}"]`)).toHaveCount(0);
        await expect(page.getByText("PRIVATE_INTERNAL_DETAILS")).toHaveCount(0);
        if (outcome === 404)
          await expect(
            page.getByText("Статья не найдена", { exact: true }),
          ).toBeVisible();
        else
          await expect(
            page.getByRole("button", { name: "Повторить", exact: true }),
          ).toBeVisible();
        await page.screenshot({
          path: test.info().outputPath(`article-error-${outcome}-${width}.png`),
        });

        api.setOutcome("success");
        const releaseRetry = api.hold();
        const beforeRetry = api.reads;
        if (outcome === 404) {
          await page
            .getByRole("button", { name: "Вернуться назад", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: `Открыть материал: ${title}`,
              exact: true,
            })
            .click();
        } else {
          const retry = page.getByRole("button", {
            name: "Повторить",
            exact: true,
          });
          await retry.focus();
          await retry.press("Enter");
        }
        await expect.poll(() => api.reads).toBeGreaterThan(beforeRetry);
        await expect(page.getByText(originalText, { exact: true })).toHaveCount(
          0,
        );
        await expect(viewer(page)).toHaveCount(0);
        releaseRetry();
        await expect(
          page.getByText(recoveredText, { exact: true }),
        ).toBeVisible();
        await expect(viewer(page)).toHaveCount(0);
        await page
          .getByRole("button", {
            name: "Открыть изображение статьи",
            exact: true,
          })
          .click();
        await expect(
          viewer(page).locator(`img[src="${recoveredPhoto}"]`),
        ).toBeVisible();
        await expect(viewer(page).locator(`img[src="${photo}"]`)).toHaveCount(
          0,
        );
        await page.keyboard.press("Escape");
        await expect(viewer(page)).toHaveCount(0);
        await page.screenshot({
          path: test
            .info()
            .outputPath(`article-recovered-${outcome}-${width}.png`),
        });
      } finally {
        await api.cleanup();
      }
    });

for (const outcome of ["missing", "locked"] as const)
  test(`article refetch ${outcome} removes its old body and photo viewer`, async ({
    page,
  }) => {
    const api = await articleApi(page);
    try {
      await openCachedArticle(page);
      api.setOutcome(outcome);
      const release = api.hold();
      await page
        .getByRole("button", {
          name: `Открыть материал: ${title}`,
          exact: true,
        })
        .click();
      await expect.poll(() => api.reads).toBeGreaterThan(1);
      await page
        .getByRole("button", {
          name: "Открыть изображение статьи",
          exact: true,
        })
        .click();
      await expect(viewer(page)).toBeVisible();
      release();
      await expect(viewer(page)).toHaveCount(0);
      await expect(page.getByText(originalText, { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByText(
          outcome === "missing"
            ? "Статья не найдена"
            : "Эта статья для участниц клуба Darcy.",
          { exact: true },
        ),
      ).toBeVisible();
      api.setOutcome("success");
      await page.clock.setFixedTime(
        new Date((await page.evaluate(() => Date.now())) + 60_000),
      );
      await page
        .getByRole("button", { name: "Вернуться назад", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: `Открыть материал: ${title}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByText(recoveredText, { exact: true }),
      ).toBeVisible();
      await expect(viewer(page)).toHaveCount(0);
    } finally {
      await api.cleanup();
    }
  });
