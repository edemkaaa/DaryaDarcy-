"use client";
/** Окно возврата показывает серверную проверку оплаты и остаётся доступным для явного повтора результата. */
import { useEffect, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import { trpc } from "@/shared/api/trpc";
import { ApiError, getRequestErrorMessage } from "@/shared/api/errors";
import { parseClubAccess } from "@/shared/api/club-access";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { navigationIntentEvent } from "@/shared/navigation/navigation-intent";
import { Dialog } from "@/shared/ui/dialog";
import { Action } from "@/shared/ui/action";
import {
  pollProdamusReturnResult,
  readProdamusReturnToken,
} from "./prodamus-return-api";
import styles from "./prodamus-return-dialog.module.scss";

type View = {
  token: string;
  actor: number | null;
  message: string;
  busy: boolean;
  retryAt: number;
};
const checking =
  "Проверяем оплату на сервере… Доступ откроется только после подтверждения.";

/** Забираем ограниченную ссылку результата из fragment и проверяем её сервером; подтверждённый платёж не создаёт сессию. */
export function ProdamusReturnDialog() {
  const active = useScreenActive();
  const { user, loading, error, refreshError } = useAuth();
  const utils = trpc.useUtils();
  const actor = user?.id ?? null;
  const ready = !loading && !error && !refreshError;
  const [token, setToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // Resolving the initial identity remounts this subtree. Leave the reference
    // in the fragment until that identity is settled so the new scope can read it.
    if (!active || !ready) return;
    /** Читаем токен только на /club после установления аккаунта и сразу убираем его из адресной строки. */
    const capture = () => {
      if (window.location.pathname !== "/club") return;
      const reference = readProdamusReturnToken(window.location.hash);
      if (!reference) return;
      setToken(reference);
      // Keep the read capability in memory, not storage or the navigable URL.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    };
    capture();
    window.addEventListener("hashchange", capture);
    window.addEventListener("popstate", capture);
    window.addEventListener(navigationIntentEvent, capture);
    return () => {
      window.removeEventListener("hashchange", capture);
      window.removeEventListener("popstate", capture);
      window.removeEventListener(navigationIntentEvent, capture);
    };
  }, [active, ready]);

  useEffect(() => {
    if (!active || !token || !ready) return;
    const controller = new AbortController();
    const signal = controller.signal;
    /** Публикуем наблюдение только пока текущая проверка не отменена. */
    const publish = (message: string, busy = false, retryAt = 0) => {
      if (!signal.aborted) setView({ token, actor, message, busy, retryAt });
    };
    /** При скрытии оставляем понятную паузу и прерываем кампанию, не отменяя заказ у провайдера. */
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        publish("Проверка приостановлена. Можно проверить результат позже.");
        controller.abort();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    if (!signal.aborted) {
      publish(checking, true);
      void (async () => {
        try {
          const result = await pollProdamusReturnResult(token, signal);
          signal.throwIfAborted();
          if (result.state !== "succeeded") {
            publish(
              result.state === "pending"
                ? "Оплата пока не подтверждена. Проверка завершена; повторно платить не нужно."
                : "Не удалось подтвердить оплату по этой ссылке. Если вы оплатили, не платите повторно — уточните результат в поддержке.",
            );
            return;
          }
          // A receipt reference is not a session. Refresh only the bound account.
          if (actor !== null && Number(token.split("-")[2]) === actor) {
            await utils.club.subscription.cancel();
            signal.throwIfAborted();
            const access = parseClubAccess(
              await utils.client.club.subscription.query(undefined, { signal }),
            );
            signal.throwIfAborted();
            await utils.club.subscription.cancel();
            signal.throwIfAborted();
            utils.club.subscription.setData(undefined, access);
            publish(
              access.subscribed
                ? "Оплата подтверждена. Доступ к клубу открыт — приятного просмотра!"
                : "Оплата подтверждена. Доступ к текущему аккаунту ещё не подтверждён; проверьте позже, повторно платить не нужно.",
            );
            return;
          }
          const mail =
            result.emailStatus === "sent"
              ? `Письмо отправлено. Проверьте почту, указанную при оплате, и папку «Спам»: там инструкция ${result.nextAction === "setup" ? "для установки пароля и входа" : "для входа в ваш аккаунт"}.`
              : result.emailStatus === "pending"
                ? "Письмо готовится к отправке. Проверьте результат немного позже."
                : "Не удалось отправить письмо. Обратитесь в поддержку; повторно платить не нужно.";
          publish(`Оплата подтверждена. ${mail}`);
        } catch (cause) {
          publish(
            `Не удалось проверить результат. ${getRequestErrorMessage(cause)} Если вы оплатили, не платите повторно.`,
            false,
            cause instanceof ApiError && cause.status === 429
              ? Date.now() + (cause.retryAfterSec ?? 60) * 1000
              : 0,
          );
        }
      })();
    }
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, token, ready, actor, attempt, utils]);

  const current = view?.token === token && view.actor === actor ? view : null;
  const retryAt = current?.retryAt ?? 0;
  /** Таймер меняет доступность кнопки после паузы, сохраняя явный запуск следующей проверки. */
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);

  return (
    <Dialog
      label="Результат оплаты клуба"
      open={Boolean(token)}
      onClose={() => setToken(null)}
      motion="fade"
    >
      <div className={styles.backdrop}>
        <section className={styles.card}>
          <Action
            aria-label="Закрыть результат оплаты"
            onClick={() => setToken(null)}
            className={styles.close}
          >
            Закрыть
          </Action>
          <h2>Результат оплаты клуба</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {current?.message ?? checking}
          </p>
          <Action
            className={styles.retry}
            disabled={
              !ready || hidden || !current || current.busy || retryAt > now
            }
            onClick={() => setAttempt((value) => value + 1)}
          >
            Проверить результат
          </Action>
          {retryAt > now ? (
            <p>Повторная проверка будет доступна после паузы.</p>
          ) : null}
        </section>
      </div>
    </Dialog>
  );
}
