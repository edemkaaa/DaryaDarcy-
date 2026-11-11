/** Проверяем изоляцию локальных персональных данных по владельцу и различие обязательного/необязательного storage. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import storage, {
  setPersonalDataOwner,
  requiredStorage,
} from "../apps/frontend/src/shared/browser/storage";
let values: Map<string, string>;
/** Каждый тест получает пустой storage и неизвестного владельца. */
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  setPersonalDataOwner(null);
});
/** Очищаем scope владельца и подменённое окно. */
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});

/** Данные без доказанного owner нельзя присвоить следующему аккаунту. */
it("never migrates an unowned profile into the next account", async () => {
  values.set("@darcy_club_profile_name", "Previous person");
  setPersonalDataOwner(2);
  expect(await storage.getItem("@darcy_club_profile_name")).toBeNull();
  expect(values.has("@darcy_club_profile_name")).toBe(false);
});
/** Смена аккаунта удаляет личные результаты и черновики, сохраняя обычную подсказку интерфейса. */
it("isolates all personal state while keeping ordinary interface preferences", async () => {
  await storage.setItem("@darcy_install_guide_seen", "1");
  setPersonalDataOwner(1);
  await storage.setItem("@darcy_club_profile_name", "First person");
  await storage.setItem("@darcy_quiz_result", "PRIVATE_RESULT");
  requiredStorage.setItem("@darcy_quiz_progress", "PRIVATE_PROGRESS");
  setPersonalDataOwner(2);
  expect(await storage.getItem("@darcy_club_profile_name")).toBeNull();
  expect(await storage.getItem("@darcy_quiz_result")).toBeNull();
  expect(requiredStorage.getItem("@darcy_quiz_progress")).toBeNull();
  expect(await storage.getItem("@darcy_install_guide_seen")).toBe("1");
  expect([...values.values()].join()).not.toContain("PRIVATE_RESULT");
  expect([...values.values()].join()).not.toContain("PRIVATE_PROGRESS");
});

/** Неудачная обязательная запись должна быть видна вызывающему коду; необязательная настройка может не блокировать работу. */
it("required drafts expose storage failures while optional preferences stay optional", async () => {
  vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
    throw new Error("Storage full");
  });
  expect(() =>
    requiredStorage.setItem("@darcy_profile_name_pending", "draft"),
  ).toThrow("Storage full");
  await expect(
    storage.setItem("optional-ui-preference", "1"),
  ).resolves.toBeUndefined();
});

/** Черновики и неизвестные операции профиля не должны переходить новому пользователю. */
it("profile drafts and unknown writes are scoped and cleared on account changes", async () => {
  const keys = [
    "@darcy_club_profile_draft",
    "@darcy_profile_name_draft",
    "@darcy_club_profile_pending",
    "@darcy_profile_name_pending",
  ];
  setPersonalDataOwner(1);
  for (const key of keys) await storage.setItem(key, "PRIVATE_PROFILE_DRAFT");
  setPersonalDataOwner(2);
  for (const key of keys) expect(await storage.getItem(key)).toBeNull();
  expect([...values.values()]).not.toContain("PRIVATE_PROFILE_DRAFT");
});
