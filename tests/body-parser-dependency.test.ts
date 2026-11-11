/** Проверяем создание настоящих Express-парсеров при неверном лимите, без HTTP и больших тел. */
import express from "express";
import { describe, expect, it } from "vitest";

/** JSON, raw, text и form проверяются одной матрицей. Неверная конфигурация должна падать при создании парсера, не отключать ограничение. */
describe("Express body parsers fail closed on invalid size configuration", () => {
  // Upstream characterization: app routes currently use valid literal limits.
  // A future malformed configuration must fail at startup, not disable the cap.
  const parsers = [
    {
      name: "JSON",
      create: (limit: string | number) => express.json({ limit }),
    },
    { name: "raw", create: (limit: string | number) => express.raw({ limit }) },
    {
      name: "text",
      create: (limit: string | number) => express.text({ limit }),
    },
    {
      name: "form",
      create: (limit: string | number) =>
        express.urlencoded({ extended: false, limit }),
    },
  ];

  for (const { name, create } of parsers) {
    it.each(["not-a-size", Number.NaN])(
      `${name} rejects invalid limit %s`,
      (limit) => {
        expect(() => create(limit)).toThrow();
      },
    );
  }
});
