"use client";
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { requirePaymentUrl } from "@/shared/navigation/external-url";
import { Action } from "@/shared/ui/action";
import { readSavedClubCheckoutIntent } from "./checkout-intent";
import {
  createClubTestCheckout,
  createNextClubTestCheckout,
  type reconcileClubTestCheckout,
} from "./test-checkout";
import styles from "./club-screen.module.scss";

export type ClubCheckoutAttempt =
  | { kind: "opened" | "canceled" }
  | { kind: "error"; error: unknown };

export function ClubTestCheckoutForm({
  client,
  active,
  disabled,
  sessionReady,
  accountEmail,
  result,
  beginAction,
  finishAction,
}: {
  client: TRPCClient<AppRouter>;
  active: boolean;
  disabled: boolean;
  sessionReady: boolean;
  accountEmail: string | null;
  result: Awaited<ReturnType<typeof reconcileClubTestCheckout>> | undefined;
  beginAction: () => void;
  finishAction: (attempt: ClubCheckoutAttempt) => void;
}) {
  const [guestEmail, setGuestEmail] = useState("");
  const [plan, setPlan] = useState<"monthly" | "semiannual">("monthly");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fieldId = useId();
  const current = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const latest = useRef({
    active,
    disabled,
    sessionReady,
    accountEmail,
    finishAction,
  });
  latest.current = {
    active,
    disabled,
    sessionReady,
    accountEmail,
    finishAction,
  };
  useEffect(() => {
    mounted.current = true;
    const hidden = () => {
      if (document.hidden) current.current?.abort();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      current.current?.abort();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (!active || !sessionReady) current.current?.abort();
  }, [active, sessionReady]);
  // Never continue a request prepared for a different account recipient.
  useEffect(() => () => current.current?.abort(), [accountEmail]);

  const terminal =
    result?.state === "succeeded" || result?.state === "canceled";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      current.current ||
      !latest.current.active ||
      !latest.current.sessionReady ||
      latest.current.disabled ||
      document.hidden ||
      result === undefined
    )
      return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      getSessionRequestSignal(),
    ]);
    current.current = controller;
    setBusy(true);
    setMessage("");
    // Discard the displayed proof before starting. Any retry must first check
    // current evidence, not repeat a next-purchase action with a stale old key.
    beginAction();
    let attempt: ClubCheckoutAttempt = { kind: "canceled" };
    try {
      signal.throwIfAborted();
      if (
        readSavedClubCheckoutIntent()?.idempotencyKey !== result?.idempotencyKey
      )
        throw new Error("Сохранённая заявка изменилась.");
      const selection = { email: accountEmail ?? guestEmail, plan };
      const reply =
        terminal && result
          ? await createNextClubTestCheckout(
              client,
              { previousIdempotencyKey: result.idempotencyKey, selection },
              signal,
            )
          : await createClubTestCheckout(client, selection, signal);
      signal.throwIfAborted();
      if (
        !latest.current.active ||
        !latest.current.sessionReady ||
        latest.current.accountEmail !== accountEmail ||
        document.hidden
      )
        throw new DOMException("Purchase screen inactive", "AbortError");
      const url = new URL(requirePaymentUrl(reply.url));
      if (
        url.hostname !== "yoomoney.ru" ||
        url.port ||
        url.hash ||
        !/^\/(checkout|api-pages|payments)\//.test(url.pathname)
      )
        throw new Error("Некорректный адрес тестовой оплаты.");
      // A checkout reply is not payment proof and must not apply reply.user.
      window.location.assign(url.href);
      attempt = { kind: "opened" };
    } catch (error) {
      const canceled =
        signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      attempt = canceled ? { kind: "canceled" } : { kind: "error", error };
      if (mounted.current)
        setMessage(
          canceled
            ? "Покупка приостановлена. Сначала проверьте статус сохранённой заявки."
            : `${getRequestErrorMessage(error)} Сначала проверьте статус сохранённой заявки; новая покупка автоматически не начнётся.`,
        );
    } finally {
      if (current.current === controller) current.current = null;
      if (mounted.current) {
        setBusy(false);
        latest.current.finishAction(attempt);
      }
    }
  }
  return (
    <form onSubmit={submit} aria-label="Тестовая покупка клуба">
      <fieldset
        disabled={
          busy || !active || !sessionReady || disabled || result === undefined
        }
      >
        <legend>Получатель и срок доступа</legend>
        <label htmlFor={`${fieldId}-email`}>Почта получателя доступа</label>
        <input
          id={`${fieldId}-email`}
          className={styles.guestEmail}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={accountEmail ?? guestEmail}
          readOnly={accountEmail !== null}
          onChange={(event) => setGuestEmail(event.target.value)}
        />
        <label htmlFor={`${fieldId}-plan`}>Срок доступа</label>
        <select
          id={`${fieldId}-plan`}
          className={styles.guestEmail}
          value={plan}
          onChange={(event) =>
            setPlan(
              event.target.value === "semiannual" ? "semiannual" : "monthly",
            )
          }
        >
          <option value="monthly">1 месяц</option>
          <option value="semiannual">6 месяцев</option>
        </select>
        <Action type="submit" className={styles.action}>
          <span className={styles.subscribeButtonText}>
            {busy
              ? "Готовим тестовую оплату…"
              : terminal
                ? "Новая тестовая покупка"
                : result
                  ? "Восстановить прежнюю заявку"
                  : "Создать тестовую заявку"}
          </span>
        </Action>
      </fieldset>
      {!sessionReady && (
        <p className={styles.priceNote}>
          Для покупки дождитесь успешной проверки сессии.
        </p>
      )}
      {result && !terminal && (
        <p className={styles.priceNote}>
          Восстановление использует прежнюю заявку. Укажите ту же почту и срок
          доступа.
        </p>
      )}
      {message && (
        <p role="alert" className={styles.priceNote}>
          {message}
        </p>
      )}
    </form>
  );
}
