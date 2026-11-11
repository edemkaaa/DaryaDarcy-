import { expect, test, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { PRODUCT_DETAILS } from "../src/domain/product/catalog";

test.use({ hasTouch: true });
/** Готовим launch-config только для handoff в почтовый клиент; managerEmail можно менять независимо от карточки товара. */
const configuration = (managerEmail = "daryadarcyapp@yandex.ru") => ({
  revision: 7,
  season: "winter",
  appearance: { startsOn: "11-20", backgroundUrl: null, bannerUrl: null },
  managerEmail,
  orderMethod: "email-client",
});
/** Заказ здесь является mailto-ссылкой, а не подтверждением отправки письма. */
const orderLink = (page: Page) =>
  page.getByRole("link", { name: "Заказать через менеджера →" });
/** Отбираем ошибку проверки контакта менеджера, блокирующую неподтверждённого получателя. */
const orderError = (page: Page) =>
  page.getByRole("alert").filter({
    hasText: "Не удалось загрузить контакт менеджера",
  });

/** Перехватываем mailto-click до запуска внешней почты и записываем URL; тест не отправляет реальные письма или платежи. */
async function fixtures(page: Page, member = false) {
  await layoutApi(page, member);
  await page.addInitScript(() => {
    const browser = window as typeof window & { preparedLetters: string[] };
    browser.preparedLetters = [];
    // Inspect the handoff, never launch a real mail application or send a letter.
    document.addEventListener(
      "click",
      (event) => {
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>('a[href^="mailto:"]')
            : null;
        if (!link) return;
        event.preventDefault();
        browser.preparedLetters.push(link.href);
      },
      true,
    );
  });
  const procedures: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/trpc/"))
      procedures.push(...decodeURIComponent(path.slice(10)).split(","));
  });
  return procedures;
}

const digitalProducts = [
  { id: "digital-1", title: "Пособие по атмосферной фотографии" },
  { id: "digital-2", title: "Винтажные книги и открытки" },
];

/** Два цифровых товара используют получателя из config; проверяем guest/member, загрузку, ошибки, offline, смену адреса и доступность handoff. */
for (const product of digitalProducts) {
  test.describe(product.id, () => {
    const path = `/shop/${product.id}`;
    for (const member of [false, true]) {
      test(`the material prepares a letter for ${member ? "a member" : "a guest"} without checkout or entitlement reads`, async ({
        page,
      }) => {
        const procedures = await fixtures(page, member);
        if (member) await page.setViewportSize({ width: 1440, height: 844 });
        await page.route("**/api/launch-config", (route) =>
          route.fulfill({ json: configuration() }),
        );
        await gotoWithSession(page, `${path}?paid=1`);
        await expect(orderLink(page)).toBeVisible();
        if (member) await orderLink(page).click();
        else await orderLink(page).tap();
        const letters = await page.evaluate(
          () =>
            (window as typeof window & { preparedLetters: string[] })
              .preparedLetters,
        );
        expect(letters).toHaveLength(1);
        const mail = new URL(letters[0]);
        expect(mail.pathname).toBe("daryadarcyapp@yandex.ru");
        expect(mail.searchParams.get("subject")).toBe(
          `Заказ: ${product.title}`,
        );
        expect(mail.searchParams.get("body")).toContain(product.title);
        expect(mail.searchParams.get("body")).toContain(
          new URL(path, page.url()).href,
        );
        expect(mail.searchParams.get("body")).not.toMatch(
          /paid=1|50|1000|2000|₽/,
        );
        expect(new URL(page.url()).pathname).toBe(path);
        // Navigation now removes untrusted legacy payment flags from app URLs.
        await expect
          .poll(() => new URL(page.url()).searchParams.get("paid"))
          .toBeNull();
        await expect(
          page.getByText(
            /Заказ отправлен|Оплата получена|Файл отправим|Оплата через Prodamus|15 минут/,
          ),
        ).toHaveCount(0);
        expect(procedures).not.toContain("shop.createCheckout");
        expect(procedures).not.toContain("shop.owned");
        await expect(
          page.getByText(
            "Если приложение не открылось, напишите: daryadarcyapp@yandex.ru",
          ),
        ).toBeVisible();
      });
    }

    test("loading a manager contact keeps ordering disabled until validation completes", async ({
      page,
    }) => {
      await fixtures(page);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/launch-config", async (route) => {
        await gate;
        await route.fulfill({ json: configuration() });
      });
      await gotoWithSession(page, path);
      await expect(
        page.getByRole("button", { name: "Загружаем контакт менеджера…" }),
      ).toBeDisabled();
      await expect(orderLink(page)).toHaveCount(0);
      release();
      await expect(orderLink(page)).toBeVisible();
    });

    /** Отсутствующий, недопустимый, временно недоступный или неподдерживаемый config не разрешает отправку на fallback-адрес. */
    for (const failure of [
      "unavailable",
      "missing",
      "invalid",
      "unsupported",
    ] as const) {
      test(`a ${failure} configuration offers a retry without ordering to a fallback recipient`, async ({
        page,
      }) => {
        await fixtures(page);
        let failed = true;
        await page.route("**/api/launch-config", (route) => {
          if (!failed)
            return route.fulfill({
              json: configuration("new-manager@example.test"),
            });
          return failure === "unavailable"
            ? route.fulfill({
                status: 503,
                json: { error: "PRIVATE_SERVER_DETAILS" },
              })
            : route.fulfill({
                json: {
                  ...configuration(),
                  ...(failure === "unsupported"
                    ? { orderMethod: "server" }
                    : {
                        managerEmail:
                          failure === "missing"
                            ? null
                            : "manager@example.test?bcc=other@example.test",
                      }),
                },
              });
        });
        await gotoWithSession(page, path);
        await expect(orderError(page)).toContainText(
          "Не удалось загрузить контакт менеджера",
        );
        await expect(
          page.getByRole("button", { name: "Заказать через менеджера →" }),
        ).toBeDisabled();
        await expect(orderLink(page)).toHaveCount(0);
        await expect(page.getByText("PRIVATE_SERVER_DETAILS")).toHaveCount(0);
        failed = false;
        await page
          .getByRole("button", { name: "Повторить", exact: true })
          .click();
        await expect(orderLink(page)).toHaveAttribute(
          "href",
          /^mailto:new-manager@example\.test\?/,
        );
      });
    }

    test("a failed refresh disables an old recipient and a retry uses the updated one", async ({
      page,
    }) => {
      await fixtures(page);
      let available = true;
      await page.route("**/api/launch-config", (route) =>
        available
          ? route.fulfill({ json: configuration("updated@example.test") })
          : route.fulfill({ status: 503, json: { error: "Unavailable" } }),
      );
      await gotoWithSession(page, path);
      await expect(orderLink(page)).toBeVisible();
      available = false;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(orderError(page)).toBeVisible();
      await expect(orderLink(page)).toHaveCount(0);
      await expect(page.getByText(/Если приложение не открылось/)).toHaveCount(
        0,
      );
      available = true;
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect(orderLink(page)).toHaveAttribute(
        "href",
        /^mailto:updated@example\.test\?/,
      );
    });

    /** При offline старый получатель скрыт до свежей проверки; восстановление сети подставляет обновлённый адрес. */
    test("a paused refresh hides a cached recipient until connectivity returns", async ({
      page,
      context,
    }) => {
      await fixtures(page);
      let email = "first@example.test";
      await page.route("**/api/launch-config", (route) =>
        route.fulfill({ json: configuration(email) }),
      );
      await gotoWithSession(page, path);
      await expect(orderLink(page)).toBeVisible();
      try {
        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(
          page.getByRole("button", { name: "Нет соединения" }),
        ).toBeDisabled();
        await expect(orderLink(page)).toHaveCount(0);
        await expect(
          page.getByText(/Если приложение не открылось/),
        ).toHaveCount(0);
        email = "second@example.test";
      } finally {
        await context.setOffline(false);
      }
      await expect(orderLink(page)).toHaveAttribute(
        "href",
        /^mailto:second@example\.test\?/,
      );
    });

    /** Возвращение из отменённого почтового клиента обновляет контакт и не объявляет заказ отправленным. */
    test("returning from a cancelled letter keeps the card available and refreshes the contact", async ({
      page,
    }) => {
      await fixtures(page);
      let email = "first@example.test";
      await page.route("**/api/launch-config", (route) =>
        route.fulfill({ json: configuration(email) }),
      );
      await gotoWithSession(page, path);
      const link = orderLink(page);
      await expect(link).toBeVisible();
      await link.focus();
      await page.keyboard.press("Enter");
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { preparedLetters: string[] })
              .preparedLetters.length,
        ),
      ).toBe(1);
      email = "second@example.test";
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(link).toHaveAttribute(
        "href",
        /^mailto:second@example\.test\?/,
      );
      await expect(page.getByText("Заказ отправлен")).toHaveCount(0);
    });

    for (const width of [390, 1440]) {
      test(`the order control preserves the existing card styling at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await fixtures(page);
        await gotoWithSession(page, path);
        const link = orderLink(page);
        await expect(link).toBeVisible();
        await link.scrollIntoViewIfNeeded();
        const style = await link.evaluate((element) => {
          const computed = getComputedStyle(element);
          return {
            radius: computed.borderRadius,
            padding: computed.paddingTop,
            font: getComputedStyle(element.querySelector("span")!).fontSize,
          };
        });
        expect(style.radius).toBe("12px");
        expect(style.padding).toBe("13px");
        expect(style.font).toBe("16px");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: test
            .info()
            .outputPath(`manager-order-${product.id}-${width}.png`),
        });
      });
    }
  });
}

/** Физические книги сохраняют внешние маркетплейсы и не читают контакт менеджера. */
for (const path of ["/shop/book-1", "/shop/book-2", "/shop/book-3"]) {
  test(`books preserve their external purchase links on ${path}`, async ({
    page,
  }) => {
    const procedures = await fixtures(page);
    let managerReads = 0;
    await page.route("**/api/launch-config", (route) => {
      managerReads++;
      return route.fulfill({ json: configuration() });
    });
    await gotoWithSession(page, path);
    await expect(orderLink(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Купить на Ozon →" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Купить на Wildberries →" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Купить в Европе", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      const browser = window as typeof window & { openedUrls: string[] };
      browser.openedUrls = [];
      /** Наблюдаем внешние адреса без открытия настоящих магазинов и без покупки. */
      window.open = (url) => {
        browser.openedUrls.push(String(url));
        return null;
      };
    });
    const book = PRODUCT_DETAILS.find((item) => path.endsWith(`/${item.id}`))!;
    for (const link of book.links) {
      await page
        .getByRole("button", {
          name:
            link.size === "secondary" ? link.name : `Купить на ${link.name} →`,
          exact: true,
        })
        .click();
    }
    expect(
      await page.evaluate(
        () => (window as typeof window & { openedUrls: string[] }).openedUrls,
      ),
    ).toEqual(book.links.map((link) => link.url));
    expect(managerReads).toBe(0);
    expect(procedures).not.toContain("shop.createCheckout");
    expect(procedures).not.toContain("shop.owned");
  });
}
