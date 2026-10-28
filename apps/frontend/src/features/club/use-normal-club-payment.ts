"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/domain/session/session-context";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import { trpc } from "@/shared/api/trpc";
import { parseClubAccess } from "@/shared/api/club-access";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { watchCheckoutDeparture } from "@/shared/navigation/navigation-start";
import {
  OperationScope,
  type ScopedOperation,
} from "@/shared/browser/operation-scope";
import {
  NormalCheckoutJournal,
  checkNormalCheckout,
  createNormalCheckout,
  type NormalCheckoutIntent,
  type NormalCheckoutStatus,
} from "./normal-checkout";

type PurchaseState = {
  ownerId: number;
  intent: NormalCheckoutIntent | null;
  result?: NormalCheckoutStatus;
  notice: string | null;
  error: string | null;
};
function describePurchase(result: NormalCheckoutStatus): string {
  switch (result.state) {
    case "notRecorded":
      return "Создание покупки пока не подтверждено. Первый запрос ещё может завершиться. Восстановление использует прежнюю покупку.";
    case "pending":
      return "Оплата этой покупки пока не подтверждена. Проверка результата не требует повторной оплаты.";
    case "failed":
      return "Эта покупка завершилась без подтверждённой оплаты. Новую покупку можно начать отдельным действием.";
    case "succeeded":
      return `Оплата этой покупки подтверждена. Оплаченный срок до ${result.expiresAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}. Текущий доступ проверяется отдельно.`;
  }
}

/** NORMAL intent recovery never uses subscription state as payment evidence. */
export function useNormalClubPayment({
  enabled,
  active,
  returnKey,
}: {
  enabled: boolean;
  active: boolean;
  returnKey: string | null;
}) {
  const { user, loading, error, refreshError } = useAuth();
  const utils = trpc.useUtils();
  const ownerId = user?.id;
  const ready =
    enabled &&
    active &&
    Boolean(ownerId) &&
    !loading &&
    !error &&
    !refreshError;
  const [scope] = useState(() => new OperationScope());
  const kind = useSyncExternalStore(
    scope.subscribe,
    scope.getSnapshot,
    () => null,
  );
  const [state, setState] = useState<PurchaseState | null>(null);
  const departing = useRef(false);
  const identity = useRef({ ready, ownerId });
  identity.current = { ready, ownerId };
  const current = state?.ownerId === ownerId ? state : null;
  const begin = (name: string) => {
    if (!ready || !ownerId || document.hidden) return null;
    // A fresh explicit action may recover if an attempted navigation failed.
    // The cancelled operation itself cannot regain ownership of its redirect.
    departing.current = false;
    return scope.begin(
      name,
      getSessionRequestSignal(),
      () =>
        identity.current.ready &&
        !departing.current &&
        identity.current.ownerId === ownerId &&
        !document.hidden &&
        isPersonalDataOwner(ownerId),
    );
  };
  useEffect(
    () => () => scope.cancel(),
    [scope, enabled, active, ownerId, returnKey],
  );
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
  }, [scope, enabled, active, ownerId, returnKey]);

  const apply = async (
    intent: NormalCheckoutIntent,
    result: NormalCheckoutStatus,
    task: ScopedOperation,
  ) => {
    task.assertCurrent();
    setState({
      ownerId: intent.ownerId,
      intent,
      result,
      notice: describePurchase(result),
      error: null,
    });
    if (result.state !== "succeeded") return;
    // The purchase expiry can be historical. Only subscription refresh grants current access.
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
          ownerId: intent.ownerId,
          intent,
          result,
          notice: `${describePurchase(result)} Не удалось обновить текущий доступ; повторите проверку позже.`,
          error: null,
        });
    }
  };
  const rememberError = (
    cause: unknown,
    journal: NormalCheckoutJournal,
    task: ScopedOperation,
  ) => {
    checkOperationAccessError(cause);
    if (!task.isCurrent()) return;
    let intent: NormalCheckoutIntent | null = current?.intent ?? null;
    try {
      intent = journal.read() ?? intent;
    } catch {
      /* Keep damaged evidence in storage; no replacement. */
    }
    const status = getHttpStatus(cause);
    const message =
      status === 409
        ? "Параметры сохранённой покупки изменились. Проверьте её результат; новый заказ не создавался."
        : status === 412
          ? "Восстановление оплаты недоступно. Сохранённая покупка остаётся прежней; другой заказ автоматически не создаётся."
          : `${getRequestErrorMessage(cause)} Результат покупки не подтверждён. Сначала проверьте сохранённую покупку.`;
    setState({
      ownerId: journal.ownerId,
      intent,
      notice: null,
      error: message,
    });
  };
  const check = async () => {
    const task = begin("check-payment");
    if (!task || !ownerId) return;
    const journal = new NormalCheckoutJournal(ownerId);
    try {
      if (current?.intent) journal.requireCurrent(current.intent, task.signal);
      const intent = journal.read();
      task.assertCurrent();
      if (!intent) {
        setState({
          ownerId,
          intent: null,
          error: null,
          notice: returnKey
            ? "На этом устройстве нет сохранённой покупки этого аккаунта. Возврат с сайта оплаты не подтверждает новую оплату."
            : "Нет сохранённой покупки. Проверка не создаёт заказ.",
        });
        return;
      }
      const reply = await checkNormalCheckout(
        utils.client,
        journal,
        intent,
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
  }, [ready, ownerId, returnKey]);

  const prepare = async () => {
    const task = begin("prepare-payment");
    if (!task || !ownerId) return;
    const journal = new NormalCheckoutJournal(ownerId);
    try {
      const terminal =
        current?.result?.state === "succeeded" ||
        current?.result?.state === "failed";
      if (current?.intent) journal.requireCurrent(current.intent, task.signal);
      const saved = journal.read();
      let intent: NormalCheckoutIntent;
      if (terminal && current?.intent) {
        // A separate click on "new purchase" verifies fresh terminal proof before rotating.
        intent = await journal.next(utils.client, current.intent, task.signal);
        task.assertCurrent();
      } else {
        intent = saved ?? (await journal.prepare(task.signal));
        task.assertCurrent();
        const checked = await checkNormalCheckout(
          utils.client,
          journal,
          intent,
          task.signal,
        );
        intent = checked.intent;
        task.assertCurrent();
        await apply(intent, checked.result, task);
        task.assertCurrent();
        if (
          checked.result.state === "succeeded" ||
          checked.result.state === "failed"
        )
          return;
      }
      setState({
        ownerId,
        intent,
        notice: "Восстанавливаем ссылку сохранённой покупки…",
        error: null,
      });
      const reply = await createNormalCheckout(
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
  const terminal =
    current?.result?.state === "succeeded" ||
    current?.result?.state === "failed";
  return {
    normalRecovery: true,
    savedGuestEmail: null,
    guestEmailLocked: false,
    hasSavedPurchase: Boolean(current?.intent),
    purchaseLabel: terminal
      ? "Новая покупка подписки"
      : current?.intent
        ? "Восстановить ссылку оплаты"
        : null,
    prepare,
    check,
    busy: kind !== null,
    preparing: kind === "prepare-payment",
    checking: kind === "check-payment",
    disabled: !ready || kind !== null,
    payError: current?.error ?? null,
    accessNotice: current?.notice ?? null,
  };
}
