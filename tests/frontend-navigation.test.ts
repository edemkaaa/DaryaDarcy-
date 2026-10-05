import { expect, it } from "vitest";
import { safeNextPath } from "../apps/frontend/src/shared/navigation/paths";

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
