/** Проверяем Browserslist, фактически используемый Babel, на малых синтетических stats без мутации глобальных прототипов. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const babelRequire = createRequire(
  require.resolve("@babel/helper-compilation-targets"),
);
const browserslist = babelRequire(
  "browserslist",
) as typeof import("browserslist");

// Bounded upstream characterization of Babel's actual build dependency.
// No hostile stats files or global prototype mutations are created.
/** Служебные имена ключей во входных stats не должны менять явно выбранную цель сборки. */
it.each(["__proto__", "constructor", "toString"])(
  "preserves explicit build targets when custom stats contain inherited key %s",
  (key) => {
    const stats = JSON.parse(`{"${key}":{"onekey":5},"chrome":{"100":50}}`);
    expect(browserslist("chrome 100", { stats })).toEqual(["chrome 100"]);
  },
);

/** Обычная фильтрация по доле использования продолжает выбирать правильный браузер. */
it("preserves ordinary custom-usage build targets", () => {
  expect(
    browserslist("> 10% in my stats", {
      stats: { chrome: { "100": 50 }, firefox: { "100": 5 } },
    }),
  ).toEqual(["chrome 100"]);
});
