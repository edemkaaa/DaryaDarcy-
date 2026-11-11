/** Режим оплаты выбирается из переменных клиентской сборки; он не заменяет соответствующую настройку API. */
export type ClubPaymentMode =
  | "live"
  | "prodamus-test"
  | "yookassa-test"
  | "unavailable";

/** Проверяем обе настройки TEST; неизвестное значение или одновременное включение двух провайдеров даёт unavailable. URL и browser storage не выбирают TEST. */
export function getClubPaymentMode(): ClubPaymentMode {
  const yookassa = process.env.NEXT_PUBLIC_CLUB_TEST_CHECKOUT;
  const prodamus = process.env.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED;
  /** Разрешаем только пустую настройку либо буквальные true/false, исключая неявную истинность строки. */
  const valid = (flag: string | undefined) =>
    flag === undefined || flag === "" || flag === "false" || flag === "true";
  if (
    !valid(yookassa) ||
    !valid(prodamus) ||
    (yookassa === "true" && prodamus === "true")
  )
    return "unavailable";
  if (prodamus === "true") return "prodamus-test";
  return yookassa === "true" ? "yookassa-test" : "live";
}

/** Включаем восстановление покупки аккаунта только с отдельным флагом и исключительно в LIVE-режиме. Выпуск требует схемы 0030 и готового серверного пути. */
export function isNormalCheckoutRecoveryEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED === "true" &&
    getClubPaymentMode() === "live"
  );
}

/** Отделяем гостевое восстановление LIVE от тестовой оплаты и восстановления авторизованного пользователя. */
export function isGuestCheckoutRecoveryEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED === "true" &&
    getClubPaymentMode() === "live"
  );
}

/** Проверяем origin, демо-параметры, сумму и форму заказа перед открытием ссылки, чтобы TEST-интерфейс не начал боевую оплату. */
export function requireProdamusTestUrl(value: string): string {
  const url = new URL(value);
  if (
    url.origin !== "https://testpage1.payform.ru" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    ["demo_mode", "payments_limit", "sum", "currency", "order_id"].some(
      (key) => url.searchParams.getAll(key).length !== 1,
    ) ||
    url.searchParams.get("demo_mode") !== "1" ||
    url.searchParams.get("payments_limit") !== "1" ||
    url.searchParams.get("sum") !== "790.00" ||
    url.searchParams.get("currency") !== "rub" ||
    !/^club-test-\d+-[0-9a-f-]{36}$/.test(
      url.searchParams.get("order_id") ?? "",
    )
  )
    throw new Error(
      "Получена ссылка другого режима оплаты. Тестовая оплата недоступна.",
    );
  return url.href;
}
