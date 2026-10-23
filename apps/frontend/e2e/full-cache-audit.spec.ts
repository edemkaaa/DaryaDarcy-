import { expect, test, type Page, type Locator } from "@playwright/test";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { LEGAL_DOCUMENTS } from "../src/features/legal/legal-documents";
import { PRODUCT_DETAILS } from "../src/domain/product/catalog";
import {
  AESTHETIC_RESULTS,
  createEmptyScores,
} from "../src/domain/quiz/quiz-data";

declare global {
  interface Window {
    cacheAuditVisible: (element: Element) => boolean;
    cacheAuditSamples: {
      pending: string[];
      faded: string[];
      loading: boolean;
    }[];
  }
}

test.skip(
  ({ baseURL, browserName }) =>
    browserName !== "chromium" || !baseURL?.endsWith(":19092"),
  "Use playwright.cache-audit.config.ts: the local HTTP fixture keeps browser caching enabled.",
);

type RouteCase = {
  path: string;
  text?: string;
  selector?: string;
  role?: "guest" | "member" | "admin" | "moderator";
  destination?: string;
  service?: boolean;
};
const routes: RouteCase[] = [
  { path: "/", selector: 'img[src*="hero_header"]' },
  { path: "/feed", text: "Публикация аудита" },
  { path: "/club", selector: '[aria-label="Разделы клуба"]' },
  { path: "/interactive", text: "ИНТЕРАКТИВ" },
  { path: "/library", selector: 'input[placeholder="Поиск материалов..."]' },
  { path: "/shop", text: "МАГАЗИН" },
  { path: "/videos", text: "Видео аудита" },
  { path: "/profile", text: "audit@example.test" },
  {
    path: "/library/patterns",
    selector: 'button[aria-label="Открыть выкройку: Остролист"]',
  },
  { path: "/library/aesthetics-guide", text: "Приватный текст cottagecore" },
  { path: "/library/about-me", text: "ТВОРЧЕСКИЙ ПУТЬ" },
  { path: "/library/article/701", text: "Статья аудита" },
  { path: "/post/501", text: "Публикация аудита" },
  { path: "/video/801", text: "Видео аудита" },
  ...PRODUCT_DETAILS.map((product) => ({
    path: `/shop/${product.id}`,
    selector: 'button[aria-label="Открыть фото товара 1"]',
  })),
  { path: "/quiz", text: "ТЕСТ-ПУТЕШЕСТВИЕ:" },
  { path: "/quiz/result", text: AESTHETIC_RESULTS.cottagecore.title },
  { path: "/login", selector: 'input[aria-label="Email"]', role: "guest" },
  { path: "/admin", selector: '[aria-label="Разделы админки"]', role: "admin" },
  { path: "/legal", text: "Юридические документы" },
  { path: "/privacy", selector: "main h1" },
  ...Object.values(LEGAL_DOCUMENTS).map((document) => ({
    path: `/legal/${document.slug}`,
    text: document.title,
  })),
  {
    path: "/oauth/callback",
    selector: 'input[aria-label="Email"]',
    role: "guest",
    destination: "/login",
    service: true,
  },
  {
    path: "/missing-cache-audit-page",
    text: "Страница не найдена.",
    service: true,
  },
  {
    path: "/legal/missing-cache-audit-document",
    text: "Страница не найдена.",
    service: true,
  },
  { path: "/shop/missing", text: "Страница не найдена.", service: true },
  { path: "/post/999", text: "Пост не найден" },
  { path: "/library/article/999", text: "Статья не найдена" },
  { path: "/video/999", text: "Видео не найдено" },
];

async function setup(page: Page, role: RouteCase["role"] = "member") {
  await page
    .context()
    .addCookies([
      { name: "cache_audit_role", value: role!, url: "http://127.0.0.1:19092" },
    ]);
  await page.addInitScript(() => {
    localStorage.setItem("@darcy_install_guide_seen", "1");
    localStorage.setItem(
      "darcy:user:101:@darcy_club_profile_completed",
      "true",
    );
    window.cacheAuditVisible = (element) => {
      if (element.closest("[hidden], [inert]")) return false;
      const rect = element.getBoundingClientRect();
      let left = Math.max(0, rect.left),
        right = Math.min(innerWidth, rect.right);
      let top = Math.max(0, rect.top),
        bottom = Math.min(innerHeight, rect.bottom);
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const bounds = parent.getBoundingClientRect(),
          style = getComputedStyle(parent);
        if (style.overflowX !== "visible") {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (style.overflowY !== "visible") {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
      }
      return right > left && bottom > top;
    };
  });
  await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/me",
    ),
    page.goto("/library", { waitUntil: "domcontentloaded" }),
  ]);
  await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.readyState))
    .toBe("complete");
  // Wait for the initial identity scope before writing a synthetic saved result.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.evaluate(
    ({ title, scores }) => {
      localStorage.setItem(
        "darcy:user:101:@darcy_quiz_result",
        JSON.stringify({
          primaryKey: "cottagecore",
          secondaryKey: null,
          isBlend: false,
          primaryTitle: title,
          scores,
          completedAt: "2026-10-01T12:00:00Z",
        }),
      );
    },
    {
      title: AESTHETIC_RESULTS.cottagecore.title,
      scores: { ...createEmptyScores(), cottagecore: 10 },
    },
  );
}

async function navigate(page: Page, path: string) {
  await page.evaluate((path) => {
    const next = (
      window as Window & { next?: { router: { push(path: string): void } } }
    ).next;
    if (!next) throw new Error("Client router unavailable");
    next.router.push(path);
  }, path);
}

function landmark(page: Page, route: RouteCase): Locator {
  return route.selector
    ? page.locator(route.selector).filter({ visible: true }).first()
    : page
        .getByText(route.text!, { exact: true })
        .filter({ visible: true })
        .first();
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.querySelectorAll<HTMLImageElement>("main img")]
        .filter(window.cacheAuditVisible)
        .map((image) => image.decode().catch(() => {})),
    );
    await Promise.all(
      document
        .querySelector("main")
        ?.getAnimations({ subtree: true })
        .filter(
          (animation) => animation.effect?.getComputedTiming().iterations === 1,
        )
        .map((animation) => animation.finished.catch(() => {})) ?? [],
    );
  });
}

for (const width of [390, 1440])
  test.describe(`${width}px`, () => {
    test.use({
      viewport: { width, height: 844 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    for (const route of routes)
      test(`warm return ${route.path}`, async ({ page }, info) => {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Network.enable");
        const cached = new Set<string>();
        const resources: {
          id: string;
          url: string;
          type: string;
          cached: boolean;
          transferred?: number;
        }[] = [];
        cdp.on("Network.requestServedFromCache", ({ requestId }) =>
          cached.add(requestId),
        );
        cdp.on("Network.responseReceived", ({ requestId, type, response }) =>
          resources.push({
            id: requestId,
            url: response.url,
            type,
            cached: response.fromDiskCache ?? false,
          }),
        );
        cdp.on(
          "Network.loadingFinished",
          ({ requestId, encodedDataLength }) => {
            const resource = resources.find(
              (resource) => resource.id === requestId,
            );
            if (resource) resource.transferred = encodedDataLength;
          },
        );
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        let documents = 0,
          rsc = 0,
          prefetch = 0;
        page.on("request", (request) => {
          if (
            request.isNavigationRequest() &&
            request.frame() === page.mainFrame()
          )
            documents++;
          if (request.headers()["rsc"] === "1") {
            if (request.headers()["next-router-prefetch"] === "1") prefetch++;
            else rsc++;
          }
        });
        await setup(page, route.role);
        await navigate(page, route.path);
        await expect(landmark(page, route)).toBeVisible();
        await expect
          .poll(() => new URL(page.url()).pathname)
          .toBe(route.destination ?? route.path);
        await settle(page);
        const firstImages = await page
          .locator("main img")
          .evaluateAll((images) =>
            images
              .filter(window.cacheAuditVisible)
              .filter(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              )
              .map((image) => (image as HTMLImageElement).currentSrc)
              .filter(Boolean),
          );
        await navigate(page, "/legal");
        if (route.path === "/legal") await navigate(page, "/library");
        await expect(
          page
            .getByText(
              route.path === "/legal" ? "БИБЛИОТЕКА" : "Юридические документы",
              { exact: true },
            )
            .filter({ visible: true })
            .first(),
        ).toBeVisible();
        const before = {
          documents,
          rsc,
          prefetch,
          resources: resources.length,
        };
        await page.evaluate(
          ({ path, images }) => {
            const samples: {
              pending: string[];
              faded: string[];
              loading: boolean;
            }[] = [];
            Object.assign(window, { cacheAuditSamples: samples });
            const start = performance.now();
            const sample = () => {
              if (location.pathname === path) {
                const visible = [
                  ...document.querySelectorAll<HTMLImageElement>("main img"),
                ].filter((image) => {
                  return (
                    images.includes(image.currentSrc || image.src) &&
                    window.cacheAuditVisible(image)
                  );
                });
                const isFaded = (image: Element) => {
                  let node: Element | null = image;
                  while (node && node.tagName !== "MAIN") {
                    if (Number(getComputedStyle(node).opacity) < 0.05)
                      return true;
                    node = node.parentElement;
                  }
                  return false;
                };
                samples.push({
                  pending: visible
                    .filter((image) => !image.complete || !image.naturalWidth)
                    .map((image) => image.currentSrc || image.src),
                  faded: visible
                    .filter((image) => {
                      if (!isFaded(image)) return false;
                      const rect = image.getBoundingClientRect();
                      // A crossfade deliberately keeps a transparent duplicate
                      // over the painted image. It is a gap only when no loaded,
                      // opaque copy of that same image covers the same position.
                      return !visible.some((other) => {
                        if (
                          other === image ||
                          other.currentSrc !== image.currentSrc ||
                          !other.complete ||
                          !other.naturalWidth ||
                          isFaded(other)
                        )
                          return false;
                        const bounds = other.getBoundingClientRect();
                        return (
                          Math.abs(bounds.x - rect.x) < 1 &&
                          Math.abs(bounds.y - rect.y) < 1 &&
                          Math.abs(bounds.width - rect.width) < 1 &&
                          Math.abs(bounds.height - rect.height) < 1
                        );
                      });
                    })
                    .map((image) => image.currentSrc || image.src),
                  loading: [
                    ...document.querySelectorAll("main [data-loading-screen]"),
                  ].some(window.cacheAuditVisible),
                });
              }
              if (performance.now() - start < 800)
                requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          },
          { path: route.destination ?? route.path, images: firstImages },
        );
        await navigate(page, route.path);
        await expect(landmark(page, route)).toBeVisible();
        await settle(page);
        await page.waitForTimeout(850);
        const samples = await page.evaluate(
          () =>
            (
              window as Window & {
                cacheAuditSamples?: {
                  pending: string[];
                  faded: string[];
                  loading: boolean;
                }[];
              }
            ).cacheAuditSamples ?? [],
        );
        const warm = resources
          .slice(before.resources)
          .filter(
            (resource) =>
              resource.type === "Image" && firstImages.includes(resource.url),
          );
        const transferred = warm.filter(
          (resource) =>
            !resource.cached &&
            !cached.has(resource.id) &&
            (resource.transferred ?? 0) > 0,
        );
        const result = {
          path: route.path,
          width,
          role: route.role ?? "member",
          samples,
          warmImages: warm,
          transferred,
          documents: documents - before.documents,
          rsc: rsc - before.rsc,
          prefetch: prefetch - before.prefetch,
          errors,
        };
        await info.attach("cache-audit", {
          body: JSON.stringify(result, null, 2),
          contentType: "application/json",
        });
        await page.screenshot({ path: info.outputPath("warm-return.png") });
        expect(errors).toEqual([]);
        expect(documents - before.documents).toBe(0);
        if (!route.service) expect(rsc - before.rsc).toBe(0);
        expect(
          samples.flatMap((sample) => sample.faded),
          "cached images must never fade from zero again",
        ).toEqual([]);
        expect(
          samples.flatMap((sample) => sample.pending),
          "cached visible images must not replay an empty loading frame",
        ).toEqual([]);
        expect(
          samples.filter((sample) => sample.loading),
          "warm route must not replay its route loader",
        ).toEqual([]);
        expect(
          transferred,
          "known unchanged images must transfer zero additional bytes",
        ).toEqual([]);
      });

    test("quiz answers and the current question survive leaving and browser Back", async ({
      page,
    }) => {
      await setup(page);
      await navigate(page, "/quiz");
      await page
        .getByRole("button", { name: "Начать путешествие", exact: true })
        .click();
      const firstAnswer = page.getByRole("button", {
        name: /^Тёплое спокойствие/,
      });
      await firstAnswer.click();
      await page.getByRole("button", { name: "Далее →", exact: true }).click();
      await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
      await navigate(page, "/legal");
      await expect(
        page.getByRole("heading", {
          name: "Юридические документы",
          exact: true,
        }),
      ).toBeVisible();
      await page.goBack();
      await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "← Назад", exact: true }).click();
      await expect(firstAnswer).toHaveAttribute("aria-pressed", "true");
    });
  });

test("every page route, product and legal slug is in the audit inventory", () => {
  const pages = readdirSync(resolve(__dirname, "../src/app"), {
    recursive: true,
  })
    .map(String)
    .filter((file) => file.endsWith("page.tsx"))
    .map(
      (file) =>
        "/" +
        file
          .replaceAll("\\", "/")
          .replace(/(?:^|\/)\([^/]+\)/g, "")
          .replace(/\/?page\.tsx$/, "")
          .replace(/^\//, ""),
    );
  const audited = new Set(
    routes.map((route) =>
      route.path
        .replace(/\/shop\/[^/]+$/, "/shop/[id]")
        .replace(/\/legal\/[^/]+$/, "/legal/[slug]")
        .replace(/\/post\/[^/]+$/, "/post/[id]")
        .replace(/\/video\/[^/]+$/, "/video/[id]")
        .replace(/\/library\/article\/[^/]+$/, "/library/article/[id]"),
    ),
  );
  expect(pages.filter((path) => !audited.has(path))).toEqual([]);
  expect(PRODUCT_DETAILS).toHaveLength(5);
  expect(Object.values(LEGAL_DOCUMENTS)).toHaveLength(8);
});

test("login fallback has no cached credential response", async ({
  request,
}) => {
  const response = await request.post("/login/submit", {
    maxRedirects: 0,
    form: {},
  });
  expect(response.status()).toBe(303);
  const cacheControl = response
    .headers()
    ["cache-control"]?.split(",")
    .map((directive) => directive.trim().toLowerCase());
  expect(cacheControl).toContain("no-store");
  expect(cacheControl).not.toContain("public");
  expect(response.headers().location).toBe("/login?form=unavailable");
});
