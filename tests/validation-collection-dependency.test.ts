/** Проверяем ограничение работы Zod на коллекциях, не полагаясь только на HTTP-размер запроса. */
import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Заведомо слишком большой массив не должен разворачивать отдельную ошибку для каждого элемента. */
describe("bounded input validation rejects oversized collections before visiting elements", () => {
  // Characterization for GHSA-mrhx-c7xc-m3w5: HTTP size limits alone must not
  // allow one invalid element to allocate another validation issue indefinitely.
  /** Ожидаем одну ошибку too_big, ограничивая диагностический результат при неверных элементах. */
  it("reports the array size violation without expanding every invalid item", () => {
    const result = z.array(z.object({ id: z.number().int() })).max(50)
      .safeParse(Array(1000).fill(null));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized input accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].code).toBe("too_big");
  });
});
