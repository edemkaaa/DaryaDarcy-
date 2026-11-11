/** Режим оплаты выбирается из переменных клиентской сборки; он не заменяет соответствующую настройку API. */
export type ClubPaymentMode =
  | "live"
  | "prodamus-test"
  | "yookassa-test"
  | "unavailable";

/** Explicit build flags only: return URLs and browser storage cannot select TEST. */
export function getClubPaymentMode(): ClubPaymentMode {
  const yookassa = process.env.NEXT_PUBLIC_CLUB_TEST_CHECKOUT;
  const prodamus = process.env.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED;
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

/** Enable only after schema 0030 and server rollout approval; TEST stays separate. */
export function isNormalCheckoutRecoveryEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED === "true" &&
    getClubPaymentMode() === "live"
  );
}

export function isGuestCheckoutRecoveryEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED === "true" &&
    getClubPaymentMode() === "live"
  );
}

/** Refuse a live payment URL when this build promises a Prodamus demo. */
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
