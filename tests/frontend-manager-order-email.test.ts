/** Проверяем формирование mailto заказа менеджеру; доставка письма и факт оплаты этим не подтверждаются. */
import { expect, it } from "vitest";
import { managerOrderEmail } from "../apps/frontend/src/domain/product/manager-order-email";
import { safeExternalUrl } from "../apps/frontend/src/shared/navigation/external-url";

const settings = {
  revision: 7,
  managerEmail: "daryadarcyapp@yandex.ru",
  orderMethod: "email-client" as const,
};
const product = { id: "digital-1", title: "Пособие по атмосферной фотографии" };

/** В письмо входят нужный товар и каноническая ссылка без придуманных цен или статуса отправки. */
it.each([product, { id: "digital-2", title: "Винтажные книги и открытки" }])(
  "prepares the configured recipient and correct product $id without asserting payment or delivery",
  (product) => {
    const href = managerOrderEmail(
      settings,
      product,
      "https://app.example.test",
    );
    const mail = new URL(href);
    expect(mail.protocol).toBe("mailto:");
    expect(mail.pathname).toBe(settings.managerEmail);
    expect(mail.searchParams.get("subject")).toBe(`Заказ: ${product.title}`);
    expect(mail.searchParams.get("body")).toContain(product.title);
    expect(mail.searchParams.get("body")).toContain(
      `https://app.example.test/shop/${product.id}`,
    );
    expect(mail.searchParams.get("body")).not.toMatch(
      /50|2000|₽|оплачен|отправлен/i,
    );
    expect([...mail.searchParams.keys()]).toEqual(["subject", "body"]);
    expect(safeExternalUrl(href)).toBe(href);
  },
);

/** Пунктуация и CRLF остаются текстом заказа, не создают Bcc/header и не сохраняют paid-query. */
it("encodes punctuation and line breaks without creating additional recipients or headers", () => {
  const mail = new URL(
    managerOrderEmail(
      { ...settings, managerEmail: "orders+shop@example.test" },
      {
        id: "digital-1",
        title: "Книга & открытки? #1\r\nBcc: other@example.test",
      },
      "https://app.example.test/shop/digital-1?paid=1",
    ),
  );
  expect(mail.pathname).toBe("orders+shop@example.test");
  expect(mail.searchParams.get("subject")).not.toMatch(/[\r\n]/);
  expect([...mail.searchParams.keys()]).toEqual(["subject", "body"]);
  expect(mail.searchParams.get("body")).toContain("Книга & открытки? #1 Bcc:");
  expect(mail.searchParams.get("body")).not.toContain("paid=1");
});

/** Исполняемые/локальные URL и credentials нельзя использовать как origin ссылки товара. */
it.each([
  "javascript:alert(1)",
  "file:///tmp/shop",
  "https://user:password@example.test",
])("rejects an unsuitable origin %s", (origin) => {
  expect(() => managerOrderEmail(settings, product, origin)).toThrow();
});

/** Неизвестный способ заказа и подмена получателя дают отказ без запасного адресата. */
it("rejects injected recipients and an unsupported method instead of using a fallback", () => {
  expect(() =>
    managerOrderEmail(
      {
        ...settings,
        managerEmail: "manager@example.test?bcc=other@example.test",
      },
      product,
      "https://app.example.test",
    ),
  ).toThrow();
  expect(() =>
    managerOrderEmail(
      { ...settings, orderMethod: "server" as "email-client" },
      product,
      "https://app.example.test",
    ),
  ).toThrow();
});
