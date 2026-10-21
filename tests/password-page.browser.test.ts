import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  chromium,
  expect as browserExpect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import type { INestApplication } from "@nestjs/common";
import { createServer, type AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { PasswordService } from "../apps/backend/src/identity/password.service";

// Actual Nest document/CSP and browser; only password persistence is replaced.
// Never connects to SQL/SMTP or the public site.
describe.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "password document UI",
  () => {
    let app: INestApplication,
      browser: Browser,
      context: BrowserContext,
      base: string;
    const token = "A".repeat(43);
    const assets = new Map([
      ["/assets/fonts/EBGaramond-Regular.ttf", "font/ttf"],
      ["/assets/fonts/PlayfairDisplay-Regular.ttf", "font/ttf"],
      ["/assets/fonts/Woolen-Regular.woff", "font/woff"],
      [
        "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp",
        "image/webp",
      ],
    ]);
    beforeAll(async () => {
      // Origin allowlist is captured when Nest is composed, before listening.
      const reservation = createServer();
      await new Promise<void>((resolve) =>
        reservation.listen(0, "127.0.0.1", resolve),
      );
      const port = (reservation.address() as AddressInfo).port;
      await new Promise<void>((resolve, reject) =>
        reservation.close((error) => (error ? reject(error) : resolve())),
      );
      base = `http://127.0.0.1:${port}`;
      vi.stubEnv("PUBLIC_APP_URL", base);
      app = await createBackendApplication();
      await app.listen(port, "127.0.0.1");
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      });
    });
    afterEach(async () => {
      if (context) await context.close();
      vi.restoreAllMocks();
    });
    afterAll(async () => {
      await browser?.close();
      await app?.close();
      vi.unstubAllEnvs();
    });
    async function open(width = 390, hash = `#token=${token}`) {
      context = await browser.newContext({ viewport: { width, height: 844 } });
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        const contentType = assets.get(url.pathname);
        if (contentType)
          return route.fulfill({
            contentType,
            body: await readFile(
              resolve("apps/frontend/public" + url.pathname),
            ),
          });
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(`${base}/api/auth/password${hash}`);
      await page.evaluate(() => document.fonts.ready);
      return page;
    }
    async function screenshot(
      page: Awaited<ReturnType<typeof open>>,
      name: string,
    ) {
      if (process.env.PASSWORD_PAGE_SCREENSHOT_DIR)
        await page.screenshot({
          path: resolve(
            process.env.PASSWORD_PAGE_SCREENSHOT_DIR,
            `${name}.png`,
          ),
          fullPage: true,
        });
    }
    it.each([320, 390, 1280])(
      "fits %ipx, keeps token out of URL, and reveals the typed password",
      async (width) => {
        const page = await open(width);
        await screenshot(page, `form-${width}`);
        expect(new URL(page.url()).hash).toBe("");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const input = page.getByLabel("Новый пароль", { exact: true });
        await input.fill("synthetic-password-only");
        await page
          .getByRole("button", { name: "Показать пароль", exact: true })
          .click();
        await browserExpect(input).toHaveAttribute("type", "text");
        await browserExpect(input).toHaveValue("synthetic-password-only");
        await page
          .getByRole("button", { name: "Скрыть пароль", exact: true })
          .click();
        await browserExpect(input).toHaveAttribute("type", "password");
      },
    );
    it.each(["", "#token=invalid"])(
      "does not offer a broken submit without a valid fragment (%s)",
      async (hash) => {
        const complete = vi.spyOn(app.get(PasswordService), "complete");
        const page = await open(390, hash);
        await browserExpect(
          page.getByRole("heading", { name: "Откройте ссылку из письма" }),
        ).toBeVisible();
        await browserExpect(page.locator("form")).toBeHidden();
        await browserExpect(
          page.getByRole("link", { name: "Перейти ко входу" }),
        ).toHaveAttribute("href", `${base}/login`);
        expect(complete).not.toHaveBeenCalled();
        await screenshot(page, "missing-link");
      },
    );
    it("sends one pending request and replaces the form with an explicit success state", async () => {
      let finish!: (result: boolean) => void;
      const complete = vi
        .spyOn(app.get(PasswordService), "complete")
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
      const page = await open();
      await page
        .getByLabel("Новый пароль", { exact: true })
        .fill("synthetic-password-only");
      await page
        .getByRole("button", { name: "Сохранить пароль", exact: true })
        .click();
      await browserExpect(
        page.getByRole("button", { name: "Сохраняем…" }),
      ).toBeDisabled();
      await page
        .locator("form")
        .evaluate((form) =>
          form.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true }),
          ),
        );
      await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
      expect(complete).toHaveBeenCalledWith(token, "synthetic-password-only");
      finish(true);
      await browserExpect(
        page.getByRole("heading", { name: "Пароль сохранён" }),
      ).toBeVisible();
      await browserExpect(page.locator("form")).toBeHidden();
      await browserExpect(
        page.getByRole("link", { name: "Перейти ко входу" }),
      ).toBeVisible();
      await screenshot(page, "success");
    });
    it("keeps the form usable after a server error and displays expired-link errors", async () => {
      const complete = vi
        .spyOn(app.get(PasswordService), "complete")
        .mockRejectedValueOnce(new Error("test-only unavailable"))
        .mockResolvedValue(false);
      const page = await open();
      await page
        .getByLabel("Новый пароль", { exact: true })
        .fill("synthetic-password-only");
      const submit = page.getByRole("button", {
        name: "Сохранить пароль",
        exact: true,
      });
      await submit.click();
      await browserExpect(page.getByRole("status")).toContainText(
        "Не удалось сохранить пароль",
      );
      await browserExpect(submit).toBeEnabled();
      await submit.click();
      await browserExpect(page.getByRole("status")).toContainText(
        "Ссылка недействительна или истекла",
      );
      expect(complete).toHaveBeenCalledTimes(2);
      await screenshot(page, "expired-link");
    });
  },
);
