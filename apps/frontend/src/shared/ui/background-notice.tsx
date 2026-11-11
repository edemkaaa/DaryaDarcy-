"use client";
/** Общие фоновые сообщения имеют владельцев и приоритет; закрытый экран не должен оставлять своё уведомление поверх другого раздела. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { StatusNotice, StatusNoticeAction } from "./status-notice";
import classes from "./background-notice.module.scss";

type NoticeAction = {
  id: string;
  label: string;
  onClick: () => unknown | Promise<unknown>;
  disabled?: boolean;
};
type Notice = {
  message: string;
  priority?: number;
  onRetry?: () => unknown | Promise<unknown>;
  actions?: NoticeAction[];
  busy?: boolean;
};
const Registry = createContext<{
  notices: Map<string, Notice>;
  register: (id: string, notice: Notice) => () => void;
} | null>(null);

/** Храним сообщения по стабильному ID владельца; регистрация возвращает удаление только его записи. */
export function BackgroundNoticeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notices, setNotices] = useState(new Map<string, Notice>());
  /** Публикуем новый экземпляр Map для React и возвращаем очистку регистрации при скрытии или размонтировании экрана. */
  const register = useCallback((id: string, notice: Notice) => {
    setNotices((previous) => new Map(previous).set(id, notice));
    return () => {
      setNotices((previous) => {
        const next = new Map(previous);
        next.delete(id);
        return next;
      });
    };
  }, []);
  return (
    <Registry.Provider value={{ notices, register }}>
      {children}
    </Registry.Provider>
  );
}

/** Регистрируем ошибку только активного экрана; актуальные действия читаем через ref и сопоставляем по ID. */
export function useBackgroundNotice({
  when,
  message,
  priority = 0,
  onRetry,
  actions,
  busy = false,
}: Notice & { when: boolean }) {
  const active = useScreenActive();
  const registry = useContext(Registry);
  const register = registry?.register;
  const id = useId();
  const callbacks = useRef({ onRetry, actions });
  useLayoutEffect(() => {
    callbacks.current = { onRetry, actions };
    // Храним актуальные обработчики без перерегистрации сообщения на каждый render.
  });
  const hasRetry = Boolean(onRetry);
  // Only presentation changes update the registry. Handlers use their current
  // versions, and stable action IDs prevent an old button invoking a new action.
  const actionKey = JSON.stringify(
    actions?.map(({ id, label, disabled }) => [id, label, !!disabled]) ?? [],
  );
  useEffect(() => {
    if (active && when && register)
    // Регистрация живёт ровно пока сообщение относится к видимому экрану; возврат register удаляет запись при cleanup.
      return register(id, {
        message,
        priority,
        busy,
        onRetry: hasRetry ? () => callbacks.current.onRetry?.() : undefined,
        actions: callbacks.current.actions?.map(({ id, label, disabled }) => ({
          id,
          label,
          disabled,
          onClick: () =>
            callbacks.current.actions
              ?.find((action) => action.id === id)
              ?.onClick(),
        })),
      });
  }, [
    active,
    when,
    register,
    id,
    message,
    priority,
    hasRetry,
    actionKey,
    busy,
  ]);
}

/** Показываем одно сообщение с наибольшим приоритетом, но общий повтор запускает все доступные восстановления. */
export function BackgroundNoticeSlot() {
  const registry = useContext(Registry);
  const [retrying, setRetrying] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const notice = [...(registry?.notices.values() ?? [])].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  )[0];
  const visible = Boolean(notice);
  const canRetry = [...(registry?.notices.values() ?? [])].some(
    (entry) => entry.onRetry,
  );
  useLayoutEffect(() => {
    const host = slot.current;
    const panel = card.current;
    const main = host?.parentElement;
    if (!host || !panel || !main || !visible) return;
    // ResizeObserver следит за меню и карточкой; MutationObserver замечает замену меню сохранённых вкладок. Оба отключаем при скрытии.
    // Main already ends above the app tabs. The club menu lives inside main;
    // measure its actual size, including safe area and responsive changes.
    let menu: Element | undefined;
    /** Измеряем живое внутреннее меню и высоту уведомления, чтобы оно не перекрывало контент при смене вкладки и размеров. */
    const measure = () => {
      const current = [
        ...main.querySelectorAll("[data-background-notice-menu]"),
      ].find((element) => element.getBoundingClientRect().height > 0);
      if (current !== menu) {
        if (menu) resize.unobserve(menu);
        menu = current;
        if (menu) resize.observe(menu);
      }
      const inset = menu
        ? Math.max(
            0,
            main.getBoundingClientRect().bottom -
              menu.getBoundingClientRect().top,
          )
        : 0;
      host.style.paddingBottom = `${inset + 12}px`;
      main.style.setProperty(
        "--background-notice-clearance",
        `${panel.getBoundingClientRect().height + 12}px`,
      );
    };
    const resize = new ResizeObserver(measure);
    resize.observe(main);
    resize.observe(panel);
    const changes = new MutationObserver(measure);
    changes.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    measure();
    return () => {
      resize.disconnect();
      changes.disconnect();
      main.style.removeProperty("--background-notice-clearance");
    };
  }, [visible]);
  if (!notice) return null;
  return (
    <div ref={slot} className={classes.slot} data-background-notice>
      <StatusNotice
        ref={card}
        className={classes.notice}
        role="status"
        actions={
          canRetry || notice.actions?.length ? (
            <>
              {canRetry && (
                <StatusNoticeAction
                  disabled={retrying || notice.busy}
                  aria-busy={retrying}
                  onClick={async () => {
                    // Один повтор восстанавливает все совместимые ошибки; allSettled не отменяет остальные из-за одного отказа.
                    if (retrying) return;
                    setRetrying(true);
                    try {
                      // One recovery action for coexisting session/content errors.
                      await Promise.allSettled(
                        [...(registry?.notices.values() ?? [])].map(
                          async (entry) => entry.onRetry?.(),
                        ),
                      );
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  {retrying ? "Проверяем…" : "Повторить"}
                </StatusNoticeAction>
              )}
              {notice.actions?.map((action) => (
                <StatusNoticeAction
                  key={action.id}
                  disabled={retrying || notice.busy || action.disabled}
                  onClick={() => void action.onClick()}
                >
                  {action.label}
                </StatusNoticeAction>
              ))}
            </>
          ) : undefined
        }
      >
        {notice.message}
      </StatusNotice>
    </div>
  );
}
