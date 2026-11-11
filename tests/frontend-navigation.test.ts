/** Политики навигации отделяют внутренний возврат, внешнюю ссылку и платёжное HTTPS-направление. */
import { expect, it } from "vitest";
import { safeNextPath } from "../apps/frontend/src/shared/navigation/paths";
import { parsePostAddress, postHref } from "../apps/frontend/src/shared/navigation/post-address";
import {
  safeExternalUrl,
  requirePaymentUrl,
} from "../apps/frontend/src/shared/navigation/external-url";

/** Новый href выбирает publicId, parse сохраняет старые numeric URL и нормализует регистр UUID. */
it("prefers a post UUID and still resolves older numeric links", () => {
  const publicId = "c22db58f-698b-41ea-8e12-524d8323b034";
  expect(postHref({ id: 706, publicId })).toBe(`/post/${publicId}`);
  expect(postHref({ id: 706 })).toBe("/post/706");
  expect(parsePostAddress("706")).toEqual({ id: 706 });
  expect(parsePostAddress(publicId.toUpperCase())).toEqual({ publicId });
  expect(parsePostAddress("706?invalid")).toBeNull();
});

/** Безопасный локальный путь может содержать query/fragment. */
it.each(["/admin", "/shop/book?paid=1", "/feed#new"])(
  "preserves an internal return path: %s",
  (path) => {
    expect(safeNextPath(path)).toBe(path);
  },
);
/** Внешний origin, protocol-relative и управляющие символы не становятся next-path. */
it.each([
  "https://example.test",
  "//example.test",
  "/\\example.test",
  "javascript:alert(1)",
  "/\n/example.test",
  "",
])("rejects an external or malformed return path: %s", (path) => {
  expect(safeNextPath(path)).toBeNull();
});
/** Из массива берём только первый допустимый параметр; отсутствие остаётся null. */
it("handles repeated and absent query parameters", () => {
  expect(safeNextPath(["/admin", "/profile"])).toBe("/admin");
  expect(safeNextPath(undefined)).toBeNull();
});

/** Исполняемые схемы, credentials и неоднозначные URL не становятся ссылкой. */
it.each([
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "https://user:secret@example.test/",
  "https://example.test/\nscript",
  "//example.test/",
  "/\\example.test/",
  "",
])("rejects executable or malformed link destinations: %s", (url) => {
  expect(safeExternalUrl(url)).toBeNull();
});

/** Обычные HTTP(S), mailto, tel и локальные пути сохраняются общей ссылочной политикой. */
it.each([
  "https://example.test/file.pdf",
  "http://127.0.0.1:8081/file.pdf",
  "mailto:manager@example.test?subject=Order",
  "tel:+79991234567",
  "/library/about-me",
])("preserves supported link destinations: %s", (url) => {
  expect(safeExternalUrl(url)).toBe(url);
});

/** Посторонние типы не приводятся к строке, в том числе при проверке оплаты. */
it.each([undefined, {}, 42])("rejects non-string destinations: %s", (url) => {
  expect(safeExternalUrl(url)).toBeNull();
  expect(() => requirePaymentUrl(url)).toThrow("некорректный адрес");
});

/** Платёжная навигация строже общей: только абсолютный HTTPS. */
it("allows HTTPS payment destinations and rejects other link types", () => {
  expect(requirePaymentUrl("https://pay.example.test/order?id=1")).toBe(
    "https://pay.example.test/order?id=1",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://pay.example.test/",
    "/club",
    "mailto:pay@example.test",
  ])
    expect(() => requirePaymentUrl(url)).toThrow("некорректный адрес");
});
