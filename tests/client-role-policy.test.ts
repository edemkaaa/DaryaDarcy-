/** Проверяем, что клиентские административные элементы зависят от роли, а не старых owner-подсказок. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
let isOwnerUser: typeof import("../apps/frontend/src/shared/config/api").isOwnerUser;
/** Подставляем устаревшие owner email/openId до импорта модуля, чтобы проверить отсутствие доверия к ним. */
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_OWNER_EMAIL", "owner@example.test");
  vi.stubEnv("NEXT_PUBLIC_OWNER_OPEN_ID", "legacy-owner-id");
  ({ isOwnerUser } = await import("../apps/frontend/src/shared/config/api"));
});
/** Убираем тестовые переменные окружения. */
afterAll(() => vi.unstubAllEnvs());
/** Только admin получает owner controls; moderator не повышается до администратора. */
it("uses an explicit administrator role for owner controls", () => {
  expect(isOwnerUser({ role: "admin", email: "staff@example.test" })).toBe(true);
  expect(isOwnerUser({ role: "moderator", email: "staff@example.test" })).toBe(false);
});
/** Совпадающий email обычного пользователя не выдаёт административный интерфейс. */
it("does not infer owner controls from a matching email", () => {
  expect(isOwnerUser({ role: "user", email: "OWNER@example.test" })).toBe(false);
});
/** Старый строковый ярлык openId не заменяет проверенную роль. */
it("does not infer owner controls from a legacy openId label", () => {
  expect(isOwnerUser({ role: "user", openId: "legacy-owner-id" })).toBe(false);
});
/** Пока профиль не загружен, owner controls недоступны. */
it("does not grant owner controls without a loaded user", () => {
  expect(isOwnerUser(null)).toBe(false);
});
