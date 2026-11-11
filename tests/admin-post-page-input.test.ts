/** Проверяем совместимость строгой схемы административной пагинации с infinite-query клиентом. */
import { describe, expect, it } from "vitest";
import { adminPostsPageInput } from "../apps/backend/src/content/admin-post-reads";

/** Forward-hint клиента не должен превращать разрешённый запрос в ошибку валидации. */
describe("admin post page transport input", () => {
  /** Принимаем направление вперёд вместе с прежним числовым cursor. */
  it("accepts the forward direction sent by the infinite-query client", () => {
    expect(
      adminPostsPageInput.parse({
        limit: 20,
        direction: "forward",
        cursor: 20,
      }),
    ).toMatchObject({ limit: 20, cursor: 20 });
  });

  /** Сохраняем прямой вызов старого клиента без direction. */
  it("keeps direct queries without a direction compatible", () => {
    expect(adminPostsPageInput.parse({ limit: 20 })).toMatchObject({
      limit: 20,
    });
  });

  /** Неподдерживаемое направление отклоняется, а не меняет смысл cursor. */
  it.each(["backward", "other", null, 1])(
    "rejects unsupported direction %s instead of reversing the cursor",
    (direction) => {
      expect(adminPostsPageInput.safeParse({ direction }).success).toBe(false);
    },
  );

  /** Совместимость с одним hint не делает схему открытой для произвольных полей. */
  it("still rejects unknown pagination fields", () => {
    expect(adminPostsPageInput.safeParse({ offset: 20 }).success).toBe(false);
  });
});
