import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const pdfUrl = "https://disk.yandex.ru/i/nDfsd5ptLO1xRA";
const winterKeys = ["holly", "sock", "star", "apple"];
type Actor = "guest" | "unpaid" | "member" | "admin";

async function fixture(page: Page, actor: Actor, failed = false) {
  const allowed = actor === "member" || actor === "admin";
  await layoutApi(page, allowed);
  if (actor !== "guest")
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 101,
            openId: `free-pattern-${actor}`,
            name: "Проверка",
            email: "pattern@example.test",
            role: actor === "admin" ? "admin" : "user",
            lastSignedIn: "2026-10-22T10:00:00Z",
          },
        },
      }),
    );
  await page.addInitScript(() => {
    const browser = window as typeof window & { openedMaterials: string[] };
    browser.openedMaterials = [];
    window.open = (url) => {
      browser.openedMaterials.push(String(url));
      return null;
    };
  });
  const reads: string[] = [];
  await page.route("**/api/library/materials/patterns/files*", (route) => {
    reads.push(route.request().url());
    return route.fulfill(
      failed || !allowed
        ? { status: 404, json: { error: "Материал недоступен." } }
        : {
            json: {
              files: winterKeys.map((fileKey, sortOrder) => ({
                fileKey,
                sortOrder,
                revision: 1,
                filename: `${fileKey}.webp`,
                mimeType: "image/webp",
                fileSize: 100,
                url: `/api/media/library-files/patterns/${fileKey}`,
              })),
              nextCursor: null,
            },
          },
    );
  });
  await page.route("**/api/media/library-files/patterns/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="brown"/></svg>',
    }),
  );
  return { reads, allowed };
}

async function openedMaterials(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { openedMaterials: string[] }).openedMaterials,
  );
}

for (const actor of ["guest", "unpaid", "member", "admin"] as const) {
  test(`${actor}: library cover and download open the free PDF without a private read`, async ({
    page,
  }) => {
    const { reads } = await fixture(page, actor);
    await gotoWithSession(page, "/library");
    const cover = page.getByRole("button", {
      name: "Открыть материал: Выкройка лошадка-качалка",
      exact: true,
    });
    const card = cover.locator("..");
    await expect(card.getByText("Для участниц клуба Darcy →")).toHaveCount(0);
    await cover.click();
    await card.getByRole("button", { name: "Скачать →", exact: true }).click();
    expect(await openedMaterials(page)).toEqual([pdfUrl, pdfUrl]);
    expect(reads).toHaveLength(0);
    expect(new URL(page.url()).pathname).toBe("/library");
  });

  test(`${actor}: free PDF is available on the patterns screen while winter files retain their access rules`, async ({
    page,
  }) => {
    const { reads, allowed } = await fixture(page, actor);
    await gotoWithSession(page, "/library/patterns");
    const pdf = page.getByRole("button", {
      name: "Открыть PDF →",
      exact: true,
    });
    await expect(pdf).toBeEnabled();
    if (allowed) {
      for (const title of ["Остролист", "Носок", "Звезда", "Яблоко"])
        await expect(
          page.getByRole("button", {
            name: `Открыть выкройку: ${title}`,
            exact: true,
          }),
        ).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: /^Открыть выкройку:/ }),
      ).toHaveCount(0);
      await expect(
        page.locator('img[src^="/api/media/library-files/"]'),
      ).toHaveCount(0);
      expect(reads).toHaveLength(0);
    }
    await page
      .getByRole("button", {
        name: "Открыть выкройку лошадки-качалки",
        exact: true,
      })
      .click();
    await pdf.click();
    expect(await openedMaterials(page)).toEqual([pdfUrl, pdfUrl]);
  });
}

for (const actor of ["member", "admin"] as const)
  test(`${actor}: private API failure does not disable the free PDF or expose winter files`, async ({
    page,
  }) => {
    await fixture(page, actor, true);
    await gotoWithSession(page, "/library/patterns");
    await expect(
      page.getByRole("button", { name: "Повторить", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Открыть выкройку:/ }),
    ).toHaveCount(0);
    const pdf = page.getByRole("button", {
      name: "Открыть PDF →",
      exact: true,
    });
    await expect(pdf).toBeEnabled();
    await pdf.click();
    expect(await openedMaterials(page)).toEqual([pdfUrl]);
  });
