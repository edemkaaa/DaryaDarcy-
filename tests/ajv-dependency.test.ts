/** Характеризуем реальную зависимость AJV линтера: повреждённый runtime pattern должен стать отказом валидации. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const lintRequire = createRequire(require.resolve("eslint/package.json"));
const Ajv = lintRequire("ajv") as typeof import("ajv");

/** Малые неверные шаблоны должны давать false и ошибку pattern, не исключение из валидатора. */
it.each(["[", "("])(
  "reports invalid runtime pattern %s as validation failure",
  (pattern) => {
    const validate = new Ajv({ $data: true }).compile({
      type: "object",
      properties: {
        value: { type: "string", pattern: { $data: "1/pattern" } },
      },
    });
    expect(validate({ pattern, value: "synthetic" })).toBe(false);
    expect(validate.errors?.[0].keyword).toBe("pattern");
  },
);

/** Проверяем defaults, required, запрет лишних полей и рабочие динамические шаблоны после исправления зависимости. */
it("preserves ordinary lint-style schemas and valid dynamic patterns", () => {
  const validate = new Ajv({ useDefaults: true }).compile({
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      name: { type: "string", pattern: "^[a-z]+$" },
    },
    required: ["name"],
    additionalProperties: false,
  });
  const config = { name: "local" };
  expect(validate(config)).toBe(true);
  expect(config).toEqual({ name: "local", enabled: true });
  expect(validate({ name: "1invalid" })).toBe(false);
  expect(validate({ name: "local", extra: true })).toBe(false);
  const dynamic = new Ajv({ $data: true }).compile({
    type: "object",
    properties: { value: { type: "string", pattern: { $data: "1/pattern" } } },
  });
  expect(dynamic({ pattern: "^ok$", value: "ok" })).toBe(true);
  expect(dynamic({ pattern: "^ok$", value: "no" })).toBe(false);
});
