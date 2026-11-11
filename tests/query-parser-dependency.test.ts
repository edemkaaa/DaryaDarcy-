/** Характеризуем установленный qs из Express на малом недоверенном query-вводе. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const expressRequire = createRequire(require.resolve("express"));
const qs = expressRequire("qs") as typeof import("qs");

// Bounded upstream characterizations of the actual legacy Express dependency.
// Do not enable these options or change application parser quotas here.
/** Явная квота comma-массива должна применяться и к обычной, и к bracket-записи; настройки приложения здесь не включаются. */
it.each(["a=1,2,3", "a[]=1,2,3"])(
  "enforces an explicitly configured comma-array limit for %s",
  (query) => {
    expect(() =>
      qs.parse(query, {
        comma: true,
        arrayLimit: 2,
        throwOnLimitExceeded: true,
      }),
    ).toThrow();
  },
);

/** Входное поле с именем метода остаётся данными при обратной сериализации. */
it("serializes parsed untrusted isBuffer data without calling it", () => {
  const parsed = qs.parse("value[constructor][isBuffer]=not-callable", {
    plainObjects: true,
  });
  expect(qs.stringify(parsed)).toBe(
    "value%5Bconstructor%5D%5BisBuffer%5D=not-callable",
  );
});

/** Обычные повторные значения и кириллица сохраняют прежнюю форму результата. */
it("preserves ordinary repeated query values and UTF-8", () => {
  expect(qs.parse("tag=one&tag=two&name=%D0%A2%D0%B5%D1%81%D1%82")).toEqual({
    tag: ["one", "two"],
    name: "Тест",
  });
});
