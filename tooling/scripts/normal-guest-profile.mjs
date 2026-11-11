// Задаёт и проверяет публичные флаги отдельной сборки гостевого восстановления оплаты; настройки платёжного провайдера здесь не хранятся.
/** Explicit build-time profile; no provider credentials or server configuration. */
export const normalGuestFlags = Object.freeze({
  NEXT_PUBLIC_CLUB_TEST_CHECKOUT: "false",
  NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "false",
  NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
  NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
});

export function assertNormalGuestBuild(manifest) {
  // Сверяет каждый флаг с manifest готового Next-build, не полагаясь на runtime env запущенного процесса.

  if (
    !Object.entries(normalGuestFlags).every(
      ([key, value]) => manifest?.config?.env?.[key] === value,
    )
  )
    throw new Error(
      "Frontend was not built with the NORMAL/GUEST payment profile",
    );
}
