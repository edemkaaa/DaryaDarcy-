import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { defaultLaunchConfiguration } from "../../apps/backend/src/launch/settings";

interface ShopManagerBrowserFixture {
  connection: Pick<Connection, "query">;
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  context: BrowserContext;
  frontend: string;
  base: string;
}

export function registerShopManagerBrowserCases(
  fixture: () => ShopManagerBrowserFixture,
) {
  // Проверяет настоящий launch-config и mailto для обоих товаров; почтовый клиент не открывается, доставка заказа этим тестом не подтверждается.

  it.each([
    { id: "digital-1", title: "Пособие по атмосферной фотографии" },
    { id: "digital-2", title: "Винтажные книги и открытки" },
  ])(
    "S2 prepares $id mail from the native launch configuration without sending it",
    async (product) => {
    // Сценарий: Для двух товаров проверяется адрес, тема и тело mailto из native конфигурации; потерянное обновление скрывает старого менеджера, отправка письма не вызывается.

      const { connection, rows, context, frontend, base } = fixture();
      const recipient = "synthetic-manager@example.test";
      const replacement = "synthetic-new-manager@example.test";
      // A fresh owned DB must not contain another suite's singleton fixture.
      expect(await rows("SELECT id FROM launch_settings WHERE id=1")).toEqual(
        [],
      );
      await connection.query(
        "INSERT INTO launch_settings (id,revision,config) VALUES (1,17,?)",
        [
          JSON.stringify({
            ...defaultLaunchConfiguration,
            managerEmail: recipient,
          }),
        ],
      );
      try {
        const before = await rows("SELECT * FROM launch_settings WHERE id=1");
        const paymentIds = await rows(
          "SELECT id FROM club_payments ORDER BY id",
        );
        await context.clearCookies();
        const page = await context.newPage();
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/launch-config",
          ),
          page.goto(frontend + `shop/${product.id}`),
        ]);
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          revision: 17,
          managerEmail: recipient,
          orderMethod: "email-client",
          capabilities: { shopOnlinePayment: false },
        });
        const order = page.getByRole("link", {
          name: "Заказать через менеджера →",
          exact: true,
        });
        await browserExpect(order).toBeVisible();
        const href = await order.getAttribute("href");
        expect(href).not.toBeNull();
        const mail = new URL(href!);
        expect(mail.protocol).toBe("mailto:");
        expect(mail.pathname).toBe(recipient);
        expect(mail.searchParams.get("subject")).toBe(
          `Заказ: ${product.title}`,
        );
        expect(mail.searchParams.get("body")).toBe(
          `Здравствуйте!\n\nХочу заказать «${product.title}».\nТовар: ${new URL(`shop/${product.id}`, frontend).href}\n\nПодскажите, пожалуйста, как оформить заказ.`,
        );
        // Next's hidden streamed S:0 copy is not the mounted application.
        const content = page.locator("#root");
        await browserExpect(content).toHaveCount(1);
        await browserExpect(
          content.getByText(
            "Откроется почтовое приложение. Отправьте письмо менеджеру самостоятельно.",
            { exact: true },
          ),
        ).toBeVisible();
        await browserExpect(
          content.getByText(
            `Если приложение не открылось, напишите: ${recipient}`,
            { exact: true },
          ),
        ).toBeVisible();
        // Inspect only: never click mailto or invoke an OS/external mail client.
        expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
          before,
        );
        // Simulate a changed native configuration while the old link is cached.
        await connection.query(
          "UPDATE launch_settings SET config=JSON_SET(config,'$.managerEmail',?),revision=18 WHERE id=1 AND revision=17 AND JSON_UNQUOTE(JSON_EXTRACT(config,'$.managerEmail'))=?",
          [replacement, recipient],
        );
        const updated = await rows("SELECT * FROM launch_settings WHERE id=1");
        expect(updated[0].revision).toBe(18);
        let loseReply = true;
        let lostReads = 0;
        await page.route("**/api/launch-config*", async (route) => {
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          expect(await response.json()).toMatchObject({
            revision: 18,
            managerEmail: replacement,
          });
          if (loseReply) {
            lostReads++;
            return route.abort("failed");
          }
          return route.fulfill({ response });
        });
        // Browser lifecycle event, not a physical-device focus acceptance claim.
        await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
        const error = page.getByRole("alert").filter({
          hasText:
            "Не удалось загрузить контакт менеджера. Попробуйте ещё раз.",
        });
        await browserExpect(
          error.getByRole("button", { name: "Повторить", exact: true }),
        ).toBeVisible();
        expect(lostReads).toBeGreaterThan(0);
        await browserExpect(order).toHaveCount(0);
        await browserExpect(
          page.getByRole("button", {
            name: "Заказать через менеджера →",
            exact: true,
          }),
        ).toBeDisabled();
        await browserExpect(
          content.getByText(
            `Если приложение не открылось, напишите: ${recipient}`,
            { exact: true },
          ),
        ).toHaveCount(0);
        loseReply = false;
        const [recovered] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/launch-config",
          ),
          error.getByRole("button", { name: "Повторить", exact: true }).click(),
        ]);
        expect(recovered.status()).toBe(200);
        await browserExpect(order).toHaveAttribute(
          "href",
          href!.replace(recipient, replacement),
        );
        await browserExpect(error).toHaveCount(0);
        expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
          updated,
        );
        expect(await rows("SELECT id FROM club_payments ORDER BY id")).toEqual(
          paymentIds,
        );
      } finally {
        await connection.query(
          "DELETE FROM launch_settings WHERE id=1 AND revision IN (17,18) AND JSON_UNQUOTE(JSON_EXTRACT(config,'$.managerEmail')) IN (?,?)",
          [recipient, replacement],
        );
      }
    },
    30_000,
  );
}
