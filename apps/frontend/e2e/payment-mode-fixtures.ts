import type { Page } from "@playwright/test";

export const modeReturnToken =
  "club-test-101-00000000-0000-4000-8000-000000000001.1792000000." +
  "a".repeat(64);
/** Засеиваем независимые журналы других платежных режимов, чтобы проверка обнаружила их случайное изменение. */
export async function seedOtherPaymentModes(page: Page, guest = true) {
  const snapshots: Record<string, string> = {
    "daryadarcy:club-checkout:yookassa-test:v1": JSON.stringify({
      version: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      selectionHash: "a".repeat(64),
    }),
  };
  if (guest)
    snapshots["darcy:guest:normal-checkout:v1"] = JSON.stringify({
      version: 1,
      ownerId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
      recoveryToken: "A".repeat(43),
      email: "saved@example.test",
      plan: "monthly",
      contactPhone: "+79991234567",
    });
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
  }, snapshots);
  return snapshots;
}
/** Снимаем точные строковые значения выбранных ключей, не нормализуя и не меняя свидетельства покупок. */
export async function paymentModeSnapshots(page: Page, keys: string[]) {
  return page.evaluate(
    (keys) =>
      Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    keys,
  );
}
