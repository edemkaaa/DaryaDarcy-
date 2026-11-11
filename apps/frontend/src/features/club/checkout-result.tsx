"use client";
/** Представление результата оплаты использует состояния контроллера и предлагает явную повторную проверку. */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { useEffect, useRef, useState } from "react";
import { Action } from "@/shared/ui/action";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { ClubTestCheckoutForm } from "./checkout-form";
import {
  createClubCheckoutResultController,
  clubCheckoutRetryAt,
  type ClubCheckoutResultState,
} from "./checkout-result-controller";
import styles from "./club-screen.module.scss";

function statusText(state: ClubCheckoutResultState): string {
  switch (state.phase) {
    case "idle":
      return "Проверьте результат сохранённой заявки.";
    case "checking":
      return "Проверяем результат на сервере…";
    case "paused":
      return "Проверка приостановлена. Нажмите «Проверить статус», чтобы продолжить.";
    case "error":
      return state.message;
    case "result":
      if (!state.result) return "В этом браузере нет сохранённой заявки.";
      switch (state.result.state) {
        case "succeeded":
          return "Тестовая оплата подтверждена сервером. Для доступа войдите в аккаунт получателя.";
        case "canceled":
          return "Тестовая оплата отменена. Новый платёж не создавался.";
        case "unknown":
          return "Результат пока неизвестен. Не оплачивайте повторно, пока не уточнён статус прежней заявки.";
        case "pending":
          return state.checking
            ? "Ожидаем результат тестовой оплаты…"
            : "Тестовая оплата ещё обрабатывается. Автоматическая проверка завершена; можно проверить позже.";
      }
  }
}

// Read-only unless the opt-in caller supplies a purchase configuration. Keep one
// controller across retained-tab hides so its quota deadline cannot be reset.
export function ClubTestCheckoutResult({
  client,
  active = true,
  purchase,
}: {
  client: TRPCClient<AppRouter>;
  active?: boolean;
  purchase?: { sessionReady: boolean; accountEmail: string | null };
}) {
  const [state, setState] = useState<ClubCheckoutResultState>({
    phase: "idle",
  });
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const controllerRef = useRef<ReturnType<
    typeof createClubCheckoutResultController
  > | null>(null);

  useEffect(() => {
    const controller = createClubCheckoutResultController(client, setState);
    controllerRef.current = controller;
    const visibilityChanged = () => {
      setHidden(document.hidden);
      if (document.hidden) controller.cancel();
      // Becoming visible never restarts a campaign or creates a payment.
    };
    visibilityChanged();
    document.addEventListener("visibilitychange", visibilityChanged);
    if (activeRef.current && !document.hidden) void controller.check();
    return () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [client]);

  useEffect(() => {
    if (!active) controllerRef.current?.cancel();
  }, [active]);

  const retryAt = state.phase === "error" ? state.retryAt : 0;
  useEffect(() => {
    if (!retryAt) return;
    setNow(Date.now());
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);

  const checking =
    state.phase === "checking" || (state.phase === "result" && state.checking);
  const coolingDown = retryAt > now;
  return (
    <section
      className={styles.priceCard}
      aria-label="Результат тестовой оплаты"
    >
      <h2 className={styles.planName}>Тестовая оплата</h2>
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className={styles.subtitleDescription}>{statusText(state)}</p>
        {coolingDown && (
          <p className={styles.priceNote}>
            Повторная проверка будет доступна после паузы.
          </p>
        )}
      </div>
      <Action
        className={styles.action}
        disabled={!active || hidden || checking || coolingDown || purchasing}
        onClick={() => {
          if (
            activeRef.current &&
            !document.hidden &&
            !purchasing &&
            !coolingDown
          )
            void controllerRef.current?.check();
        }}
      >
        <span className={styles.subscribeButtonText}>Проверить статус</span>
      </Action>
      {purchase && (
        <ClubTestCheckoutForm
          client={client}
          active={active && !hidden}
          disabled={checking || coolingDown}
          {...purchase}
          result={state.phase === "result" ? state.result : undefined}
          beginAction={() => {
            setPurchasing(true);
            setState({ phase: "idle" });
          }}
          finishAction={(attempt) => {
            setPurchasing(false);
            setState(
              attempt.kind === "error"
                ? {
                    phase: "error",
                    message: getRequestErrorMessage(attempt.error),
                    retryAt: clubCheckoutRetryAt(attempt.error),
                  }
                : { phase: attempt.kind === "canceled" ? "paused" : "idle" },
            );
          }}
        />
      )}
      <p className={styles.priceNote}>
        Только тестовый режим. Автопродления нет.
      </p>
    </section>
  );
}
