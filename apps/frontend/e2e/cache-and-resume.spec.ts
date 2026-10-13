import { test, expect } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

for (const first of ["focus", "visibilitychange"] as const) {
  test(`a fast ${first} check is not repeated by the paired resume event`, async ({
    page,
  }) => {
    await layoutApi(page);
    await gotoWithSession(page, "/feed");
    // The HTTP response can precede hydration/session completion in WebKit.
    await expect(
      page
        .getByText(/Проверка длинной публикации и прокрутки содержимого/)
        .first(),
    ).toBeVisible();
    // A real focus event during initial navigation may already start the
    // coalescing window. The measured return begins after that window.
    await page.waitForTimeout(1000);
    let checks = 0;
    await page.route("**/api/auth/me", (route) => {
      checks++;
      return route.fulfill({ json: { user: null } });
    });
    const checked = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/me"),
    );
    const dispatch = (event: string) =>
      page.evaluate((event) => {
        (event === "focus" ? window : document).dispatchEvent(new Event(event));
      }, event);
    await dispatch(first);
    await checked;
    await dispatch(first === "focus" ? "visibilitychange" : "focus");
    await page.waitForTimeout(150);
    expect(checks).toBe(1);
    // The brief coalescing window must not suppress a subsequent access check.
    await page.waitForTimeout(1000);
    await dispatch("focus");
    await expect.poll(() => checks).toBe(2);
  });
}

for (const subscribed of [false, true]) {
  test(`stale feed data and scroll survive focus and reconnect for a ${subscribed ? "member" : "guest"}`, async ({
    page,
  }) => {
    await layoutApi(page, subscribed);
    const content: string[] = [];
    let sessionChecks = 0;
    let subscriptionChecks = 0;
    let documentRequests = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documentRequests++;
      const path = new URL(request.url()).pathname;
      if (path === "/api/auth/me") sessionChecks++;
      if (path.startsWith("/api/trpc/")) {
        for (const name of decodeURIComponent(
          path.split("/api/trpc/")[1],
        ).split(",")) {
          if (name === "club.subscription") subscriptionChecks++;
          else content.push(name);
        }
      }
    });
    await gotoWithSession(page, "/feed");
    await expect(
      page
        .getByText(/Проверка длинной публикации и прокрутки содержимого/)
        .first(),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const scroll = (await page
      .locator("main .ui-scroll:not(.ui-scroll-horizontal)")
      .first()
      .elementHandle())!;
    const scrollTop = await scroll.evaluate((element) => {
      element.scrollTop = 300;
      return element.scrollTop;
    });
    const before = [...content];
    const beforeSession = sessionChecks;
    const beforeSubscription = subscriptionChecks;
    const beforeDocuments = documentRequests;
    await page.clock.install();
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    await page.clock.fastForward(31_000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("offline"));
    });
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    await expect.poll(() => sessionChecks).toBeGreaterThan(beforeSession);
    if (subscribed)
      await expect
        .poll(() => subscriptionChecks)
        .toBeGreaterThan(beforeSubscription);
    await page.clock.runFor(200);
    expect(content).toEqual(before);
    expect(documentRequests).toBe(beforeDocuments);
    expect(await scroll.evaluate((element) => element.isConnected)).toBe(true);
    expect(await scroll.evaluate((element) => element.scrollTop)).toBe(
      scrollTop,
    );
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  });
}

test("browser really reuses hashed artwork on a second visit", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Cache transfer evidence requires Chromium CDP",
  );
  // Playwright routing disables HTTP caching. This check uses the real static
  // server with no intercepted requests and does not require a running API.
  await page.addInitScript(() =>
    localStorage.setItem("@darcy_install_guide_seen", "1"),
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const cached = new Set<string>();
  const responses: {
    id: string;
    url: string;
    disk: boolean;
    cacheControl: string;
    transferred?: number;
  }[] = [];
  cdp.on("Network.requestServedFromCache", ({ requestId }) =>
    cached.add(requestId),
  );
  cdp.on("Network.responseReceived", ({ requestId, response }) => {
    if (!response.url.includes("hero_header")) return;
    responses.push({
      id: requestId,
      url: response.url,
      disk: response.fromDiskCache ?? false,
      cacheControl: String(
        response.headers["Cache-Control"] ?? response.headers["cache-control"],
      ),
    });
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const entry = responses.find((response) => response.id === requestId);
    if (entry) entry.transferred = encodedDataLength;
  });
  const openHome = async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const hero = page.locator('img[src*="hero_header"]').first();
    await expect(hero).toBeVisible();
    await hero.evaluate((img) => (img as HTMLImageElement).decode());
    return hero.evaluate((img) => (img as HTMLImageElement).currentSrc);
  };
  const coldUrl = await openHome();
  expect(
    responses.some(
      (entry) =>
        entry.url === coldUrl &&
        entry.cacheControl === "public, max-age=31536000, immutable",
    ),
  ).toBe(true);
  const firstVisit = responses.length;
  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  expect(await openHome()).toBe(coldUrl);
  await expect.poll(() => responses.length).toBeGreaterThan(firstVisit);
  const warm = responses
    .slice(firstVisit)
    .find((entry) => entry.url === coldUrl)!;
  expect(warm.disk || cached.has(warm.id)).toBe(true);
  await expect.poll(() => warm.transferred).toBe(0);
  await test.info().attach("browser-image-cache", {
    body: JSON.stringify(
      { coldUrl, visits: responses, cached: [...cached] },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
