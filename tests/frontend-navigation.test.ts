import { expect, it } from "vitest";
import { safeNextPath } from "../apps/frontend/src/shared/navigation/paths";
import {
  safeExternalUrl,
  requirePaymentUrl,
} from "../apps/frontend/src/shared/navigation/external-url";

it.each(["/admin", "/shop/book?paid=1", "/feed#new"])(
  "preserves an internal return path: %s",
  (path) => {
    expect(safeNextPath(path)).toBe(path);
  },
);
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
it("handles repeated and absent query parameters", () => {
  expect(safeNextPath(["/admin", "/profile"])).toBe("/admin");
  expect(safeNextPath(undefined)).toBeNull();
});

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

it.each([
  "https://example.test/file.pdf",
  "http://127.0.0.1:8081/file.pdf",
  "mailto:manager@example.test?subject=Order",
  "tel:+79991234567",
  "/library/about-me",
])("preserves supported link destinations: %s", (url) => {
  expect(safeExternalUrl(url)).toBe(url);
});

it.each([undefined, {}, 42])("rejects non-string destinations: %s", (url) => {
  expect(safeExternalUrl(url)).toBeNull();
  expect(() => requirePaymentUrl(url)).toThrow("некорректный адрес");
});

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
