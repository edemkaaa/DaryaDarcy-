"use client";
/** Гостевой журнал удерживает email и ключ покупки до её проверки; вход не превращает старый заказ в новый. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/domain/session/session-context";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import { parseClubAccess } from "@/shared/api/club-access";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { trpc } from "@/shared/api/trpc";
import {
  OperationScope,
  type ScopedOperation,
} from "@/shared/browser/operation-scope";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { watchCheckoutDeparture } from "@/shared/navigation/navigation-start";
import {
  GUEST_CHECKOUT_STORAGE_KEY,
  GuestCheckoutJournal,
  GuestCheckoutRecipientError,
  checkGuestCheckout,
  createGuestCheckout,
  type GuestCheckoutIntent,
} from "./guest-normal-checkout";
import type { NormalCheckoutStatus } from "./normal-checkout";

type PurchaseState = {
  identity: string;
  present: boolean;
  intent: GuestCheckoutIntent | null;
  result?: NormalCheckoutStatus;
  notice: string | null;
  error: string | null;
  foreignRecipient?: boolean;
};
function describe(result: NormalCheckoutStatus, authenticated: boolean) {
  switch (result.state) {
    case "notRecorded":
      return "Создание покупки пока не подтверждено. Восстановление использует прежние ключи; новый заказ автоматически не создаётся.";
    case "pending":
      return "Оплата этой покупки пока не подтверждена. Если вы уже оплатили, повторно платить не нужно — проверьте покупку позже.";
    case "failed":
      return "Эта покупка завершилась без подтверждённой оплаты. Новую покупку можно начать отдельным действием.";
    case "succeeded":
      return `Оплата этой покупки подтверждена. Оплаченный срок до ${result.expiresAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}. ${authenticated ? "Текущий доступ проверяется отдельно." : "Для доступа войдите с почтой получателя. Подтверждение оплаты не выполняет вход в аккаунт."}`;
  }
}

/** A guest purchase survives login; changing identity never changes its proof. */
export function useGuestClubPayment({
  enabled,
  active,
  returnKey,
  guestEmail,
  contactPhone,
}: {
  enabled: boolean;
  active: boolean;
  returnKey: string | null;
  guestEmail: string;
  contactPhone: string;
}) {
  const { user, loading, error, refreshError } = useAuth();
  const utils = trpc.useUtils();
  const ownerId = user?.id ?? null;
  const email = user?.email ?? null;
  const identityKey = JSON.stringify([ownerId, email]);
  const ready = enabled && active && !loading && !error && !refreshError;
  const [scope] = useState(() => new OperationScope());
  const kind = useSyncExternalStore(
    scope.subscribe,
    scope.getSnapshot,
    () => null,
  );
  const [state, setState] = useState<PurchaseState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const current = state?.identity === identityKey ? state : null;
  const known = useRef<{
    identity: string;
    intent: GuestCheckoutIntent;
  } | null>(null);
  const expectedIntent = () =>
    current?.intent ??
    (known.current?.identity === identityKey ? known.current.intent : null);
  const identity = useRef({ ready, key: identityKey });
  identity.current = { ready, key: identityKey };
  const departing = useRef(false);
  const makeJournal = () =>
    new GuestCheckoutJournal(user ? { id: user.id, email: user.email } : null);
  const begin = (name: string) => {
    if (!ready || document.hidden) return null;
    departing.current = false;
    return scope.begin(
      name,
      getSessionRequestSignal(),
      () =>
        identity.current.ready &&
        identity.current.key === identityKey &&
        !departing.current &&
        !document.hidden &&
        isPersonalDataOwner(ownerId),
    );
  };
  useEffect(() => () => scope.cancel(), [scope, ready, identityKey, returnKey]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) scope.cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [scope]);
  useEffect(() => {
    departing.current = false;
    if (!enabled || !active) return;
    return watchCheckoutDeparture(() => {
      departing.current = true;
      scope.cancel();
    });
  }, [scope, enabled, active, identityKey, returnKey]);

  const apply = async (
    intent: GuestCheckoutIntent,
    result: NormalCheckoutStatus,
    task: ScopedOperation,
  ) => {
    task.assertCurrent();
    known.current = { identity: identityKey, intent };
    setState({
      identity: identityKey,
      present: true,
      intent,
      result,
      notice: describe(result, ownerId !== null),
      error: null,
    });
    if (result.state !== "succeeded" || ownerId === null) return;
    try {
      await utils.club.subscription.cancel();
      task.assertCurrent();
      const access = parseClubAccess(
        await utils.client.club.subscription.query(undefined, {
          signal: task.signal,
        }),
      );
      task.assertCurrent();
      await utils.club.subscription.cancel();
      task.assertCurrent();
      utils.club.subscription.setData(undefined, access);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setState({
          identity: identityKey,
          present: true,
          intent,
          result,
          notice: `${describe(result, true)} Не удалось обновить текущий доступ; повторите проверку позже.`,
          error: null,
        });
    }
  };
  const rememberError = (
    cause: unknown,
    journal: GuestCheckoutJournal,
    task: ScopedOperation,
  ) => {
    if (!task.isCurrent()) return;
    // A recipient mismatch is not an expired login session.
    if (getHttpStatus(cause) === 401) checkOperationAccessError(cause);
    let intent = expectedIntent();
    try {
      intent = journal.read() ?? intent;
    } catch {
      /* Preserve unreadable evidence. */
    }
    const status = getHttpStatus(cause);
    const message =
      status === 409
        ? "Параметры сохранённой покупки изменились. Проверьте её результат; другой заказ автоматически не создаётся."
        : status === 412
          ? "Восстановление оплаты пока недоступно. Покупка сохранена; другой заказ автоматически не создаётся."
          : status === 403
            ? "Покупка недоступна текущему аккаунту. Войдите с почтой получателя. Прежние ключи сохранены."
            : cause instanceof Error && !status && !("data" in cause)
              ? cause.message
              : `${getRequestErrorMessage(cause)} Результат покупки не подтверждён. Сначала проверьте сохранённую покупку.`;
    setState({
      identity: identityKey,
      present: !(
        ownerId !== null && cause instanceof GuestCheckoutRecipientError
      ),
      intent,
      notice: null,
      error: message,
      foreignRecipient:
        ownerId !== null && cause instanceof GuestCheckoutRecipientError,
    });
  };
  // Гостевой заказ сохраняет своего получателя даже после входа; проверка не подменяет его заказом текущего аккаунта.
  const check = async () => {
    const task = begin("check-payment");
    if (!task) return;
    const journal = makeJournal();
    try {
      const expected = expectedIntent();
      if (expected) journal.requireCurrent(expected, task.signal);
      const saved = journal.read();
      task.assertCurrent();
      if (!saved) {
        setState({
          identity: identityKey,
          present: false,
          intent: null,
          error: null,
          notice: returnKey
            ? "На этом устройстве нет ключей сохранённой гостевой покупки. Возврат с сайта оплаты не подтверждает оплату. Проверьте её через поддержку; новая покупка автоматически не создаётся."
            : null,
        });
        return;
      }
      const reply = await checkGuestCheckout(
        utils.client,
        journal,
        saved,
        task.signal,
      );
      task.assertCurrent();
      await apply(reply.intent, reply.result, task);
    } catch (cause) {
      rememberError(cause, journal, task);
    } finally {
      task.finish();
    }
  };
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (ready) void checkRef.current();
  }, [ready, identityKey, returnKey]);
  useEffect(() => {
    if (!ready) return;
    const changed = (event: StorageEvent) => {
      if (event.key === GUEST_CHECKOUT_STORAGE_KEY || event.key === null) {
        scope.cancel();
        void checkRef.current();
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [ready, scope]);
  const retryAt = current?.intent?.retryAt ?? 0;
  useEffect(() => {
    if (!retryAt || !active) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 1000);
    setNow(Date.now());
    return () => clearInterval(timer);
  }, [retryAt, active]);

  const terminal =
    current?.result?.state === "succeeded" ||
    current?.result?.state === "failed";
  // Перед новой отправкой сверяем сохранённое намерение: контакт и ключ покупки нельзя менять в фоне.
  const prepare = async () => {
    const task = begin("prepare-payment");
    if (!task) return;
    const journal = makeJournal();
    try {
      const expected = expectedIntent();
      if (expected) journal.requireCurrent(expected, task.signal);
      const saved = journal.read();
      if (
        !saved &&
        returnKey &&
        !window.confirm(
          "Ключи прежней покупки отсутствуют. Если вы уже оплатили, не платите повторно: обратитесь в поддержку. Начать отдельную новую покупку?",
        )
      )
        return;
      const selection = {
        email:
          current?.intent && !terminal
            ? current.intent.email
            : guestEmail || saved?.email || "",
        plan: saved?.plan ?? ("monthly" as const),
        contactPhone: saved && !terminal ? saved.contactPhone : contactPhone,
      };
      let intent: GuestCheckoutIntent;
      if (terminal && current?.intent) {
        const next = await journal.next(
          utils.client,
          current.intent,
          selection,
          task.signal,
        );
        task.assertCurrent();
        if (!next) {
          known.current = null;
          setState({
            identity: identityKey,
            present: false,
            intent: null,
            notice: null,
            error: null,
          });
          return;
        }
        intent = next;
        known.current = { identity: identityKey, intent };
      } else {
        intent = await journal.prepare(selection, task.signal);
        task.assertCurrent();
        // Keep proof in memory even if a later read or storage write fails.
        known.current = { identity: identityKey, intent };
        setState({
          identity: identityKey,
          present: true,
          intent,
          notice: "Проверяем сохранённую покупку…",
          error: null,
        });
        const checked = await checkGuestCheckout(
          utils.client,
          journal,
          intent,
          task.signal,
        );
        intent = checked.intent;
        task.assertCurrent();
        await apply(intent, checked.result, task);
        if (
          checked.result.state === "succeeded" ||
          checked.result.state === "failed"
        )
          return;
        // Login cannot silently convert a not-recorded guest purchase into NORMAL.
        if (ownerId !== null && checked.result.state === "notRecorded")
          throw new Error(
            "Гостевая покупка пока не найдена. Первый запрос ещё может завершиться. Сохраните ключи и проверьте позже; новый заказ не создавался.",
          );
      }
      task.assertCurrent();
      const reply = await createGuestCheckout(
        utils.client,
        journal,
        intent,
        task.signal,
      );
      task.assertCurrent();
      await apply(reply.intent, reply.result, task);
      task.assertCurrent();
      if (reply.result.state === "pending")
        window.location.assign(reply.result.url);
    } catch (cause) {
      rememberError(cause, journal, task);
    } finally {
      task.finish();
    }
  };
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return {
    handlesPurchase:
      enabled && (ownerId === null || !current || current.present),
    normalRecovery: true,
    hasSavedPurchase: Boolean(current?.intent),
    savedGuestEmail: !terminal ? (current?.intent?.email ?? null) : null,
    savedContactPhone: !terminal
      ? (current?.intent?.contactPhone ?? null)
      : null,
    contactPhoneLocked: Boolean(current?.intent && !terminal),
    guestEmailLocked: Boolean(current?.intent) && !terminal,
    foreignRecipient: current?.foreignRecipient === true,
    purchaseLabel: terminal
      ? ownerId !== null
        ? "Перейти к новой покупке своего аккаунта"
        : "Новая покупка подписки"
      : current?.intent
        ? "Восстановить ссылку оплаты"
        : null,
    prepare,
    check,
    busy: kind !== null,
    preparing: kind === "prepare-payment",
    checking: kind === "check-payment",
    disabled: !ready || !current || kind !== null || remaining > 0,
    payError: current?.error ?? null,
    accessNotice:
      remaining > 0
        ? `Повторная проверка оплаты будет доступна через ${remaining} с. ${current?.notice ?? ""}`
        : (current?.notice ?? null),
  };
}
