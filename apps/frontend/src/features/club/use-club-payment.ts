"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/domain/session/session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import { parseClubAccess, requireClubClaim } from "@/shared/api/club-access";
import {
  ApiError,
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { trpc } from "@/shared/api/trpc";
import { OperationScope } from "@/shared/browser/operation-scope";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { requirePaymentUrl } from "@/shared/navigation/external-url";
import { requireProdamusTestUrl } from "./payment-mode";
import { isNormalCheckoutRecoveryEnabled } from "./payment-mode";
import { useNormalClubPayment } from "./use-normal-club-payment";

const uncertainCheckout =
  "Создание ссылки не подтверждено. Если вы уже оплатили, не платите повторно: проверьте доступ или обратитесь в поддержку.";
const pendingAccess =
  "Оплата пока не подтверждена. Если вы уже оплатили, подождите немного и нажмите «Я уже оплатила». Повторно платить не нужно.";
const checkingAccess =
  "Проверяем оплату… Доступ откроется после подтверждения.";

function wait(signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 2500);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Legacy Prodamus flow: URL flags are hints, never proof of a paid order. */
export function useClubPayment({
  active,
  returnKey,
  guestEmail,
  prodamusTest = false,
}: {
  active: boolean;
  returnKey: string | null;
  guestEmail: string;
  prodamusTest?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const normal =
    isAuthenticated && !prodamusTest && isNormalCheckoutRecoveryEnabled();
  const legacy = useLegacyClubPayment({
    active: active && !normal,
    returnKey,
    guestEmail,
    prodamusTest,
  });
  const recovery = useNormalClubPayment({ enabled: normal, active, returnKey });
  return normal
    ? recovery
    : {
        ...legacy,
        normalRecovery: false,
        hasSavedPurchase: false,
        purchaseLabel: null,
      };
}

function useLegacyClubPayment({
  active,
  returnKey,
  guestEmail,
  prodamusTest = false,
}: {
  active: boolean;
  returnKey: string | null;
  guestEmail: string;
  prodamusTest?: boolean;
}) {
  const retryLabel = prodamusTest ? "Проверить доступ" : "Я уже оплатила";
  const pendingNotice = prodamusTest
    ? "Тестовая оплата пока не подтверждена. Подождите немного и нажмите «Проверить доступ». Повторно платить не нужно."
    : pendingAccess;
  const { user, isAuthenticated, loading, error, refreshError } = useAuth();
  const { status: subscriptionStatus } = useClub();
  const utils = trpc.useUtils();
  const [scope] = useState(() => new OperationScope());
  const kind = useSyncExternalStore(
    scope.subscribe,
    scope.getSnapshot,
    () => null,
  );
  const identity = useRef({ active, id: user?.id });
  identity.current = { active, id: user?.id };
  const unknownCheckout = useRef(false);
  const checking = useRef(false);
  const automaticReturn = useRef<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!returnKey) setAccessNotice(null);
  }, [returnKey]);
  useEffect(() => () => scope.cancel(), [scope, active, returnKey, user?.id]);
  useEffect(() => {
    if (!active) {
      if (unknownCheckout.current) setPayError(uncertainCheckout);
      if (checking.current)
        setAccessNotice(
          `Проверка приостановлена. Нажмите «${retryLabel}», чтобы проверить доступ.`,
        );
    }
  }, [active, retryLabel]);
  const ready = active && !loading && !error && !refreshError;
  const begin = (name: string) => {
    if (!ready) return null;
    const id = user?.id;
    return scope.begin(
      name,
      getSessionRequestSignal(),
      () =>
        identity.current.active &&
        identity.current.id === id &&
        (id === undefined || isPersonalDataOwner(id)),
    );
  };

  const prepare = async () => {
    if (!ready || scope.getSnapshot()) return;
    const email = (isAuthenticated ? (user?.email ?? "") : guestEmail)
      .trim()
      .toLowerCase();
    if (
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setPayError(
        isAuthenticated && !user?.email
          ? "В аккаунте нет почты. Для оплаты обратитесь в поддержку."
          : "Укажите корректную почту для чека и входа.",
      );
      return;
    }
    if (
      unknownCheckout.current &&
      !window.confirm(
        "Результат предыдущего запроса неизвестен. Новый запрос создаст другую заявку на оплату. Если вы уже оплатили, отмените это действие и проверьте доступ. Подготовить новую ссылку?",
      )
    )
      return;
    const task = begin("prepare-payment");
    if (!task) return;
    setPayError(null);
    unknownCheckout.current = true;
    try {
      const result = await utils.client.club.createCheckout.mutate(
        { email },
        { signal: task.signal },
      );
      task.assertCurrent();
      let url: string;
      try {
        url = requirePaymentUrl(result?.url);
        if (prodamusTest) url = requireProdamusTestUrl(url);
      } catch {
        throw new ApiError(
          "Не удалось открыть оплату: получен некорректный адрес.",
          0,
          undefined,
          false,
          "invalid-response",
        );
      }
      if (result.user !== null) throw invalidResponse();
      task.assertCurrent();
      unknownCheckout.current = false;
      window.location.assign(url);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      const status = getHttpStatus(cause);
      if (status && status >= 400 && status < 500)
        unknownCheckout.current = false;
      setPayError(
        `${getRequestErrorMessage(cause)}${unknownCheckout.current ? ` ${uncertainCheckout}` : ""}`,
      );
    } finally {
      task.finish();
    }
  };

  const check = async (poll = false) => {
    if (!isAuthenticated) return;
    const task = begin("check-payment");
    if (!task) return;
    checking.current = true;
    setPayError(null);
    setAccessNotice(
      prodamusTest
        ? "Проверяем доступ… Он откроется после подтверждения тестовой оплаты сервером."
        : checkingAccess,
    );
    const budget = new AbortController();
    const timer = setTimeout(
      () =>
        budget.abort(
          new DOMException("Время проверки истекло", "TimeoutError"),
        ),
      30_000,
    );
    const signal = AbortSignal.any([task.signal, budget.signal]);
    try {
      const claim = await utils.client.club.claimPending.mutate(undefined, {
        signal,
      });
      task.assertCurrent();
      requireClubClaim(claim);
      for (let attempt = 0; attempt < (poll ? 6 : 1); attempt++) {
        signal.throwIfAborted();
        await utils.club.subscription.cancel();
        task.assertCurrent();
        const result = await utils.client.club.subscription.query(undefined, {
          signal,
        });
        signal.throwIfAborted();
        task.assertCurrent();
        const value = parseClubAccess(result);
        await utils.club.subscription.cancel();
        task.assertCurrent();
        utils.club.subscription.setData(undefined, value);
        if (value.subscribed) {
          setAccessNotice(
            value.expiresAt
              ? `Текущий доступ до ${value.expiresAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} Если срок ещё не продлился, проверьте снова немного позже.`
              : "Доступ к клубу открыт.",
          );
          return;
        }
        if (poll && attempt < 5) await wait(signal);
      }
      setAccessNotice(pendingNotice);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setAccessNotice(
          budget.signal.aborted
            ? pendingNotice
            : `Не удалось проверить доступ. ${getRequestErrorMessage(cause)} Если вы уже оплатили, не платите повторно.`,
        );
    } finally {
      clearTimeout(timer);
      checking.current = false;
      task.finish();
    }
  };
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (!returnKey) {
      automaticReturn.current = null;
      return;
    }
    if (
      prodamusTest ||
      !ready ||
      !isAuthenticated ||
      !["active", "inactive"].includes(subscriptionStatus) ||
      automaticReturn.current === returnKey
    )
      return;
    automaticReturn.current = returnKey;
    void checkRef.current(true);
  }, [returnKey, ready, isAuthenticated, subscriptionStatus, prodamusTest]);

  return {
    prepare,
    check: () => check(false),
    busy: kind !== null,
    preparing: kind === "prepare-payment",
    checking: kind === "check-payment",
    disabled: !ready || kind !== null,
    payError,
    accessNotice:
      returnKey && !isAuthenticated
        ? prodamusTest
          ? "После тестовой оплаты войдите с указанной почтой и проверьте доступ. Возврат на страницу не подтверждает оплату."
          : "После оплаты проверьте почту: в письме будет инструкция для входа. Войдите, чтобы проверить доступ к клубу."
        : accessNotice,
  };
}
