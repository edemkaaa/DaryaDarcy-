"use client";
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

type Notice = {
  message: string;
  priority?: number;
  onRetry: () => unknown | Promise<unknown>;
};
const Registry = createContext<{
  notices: Map<string, Notice>;
  register: (id: string, notice: Notice) => () => void;
} | null>(null);

export function BackgroundNoticeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notices, setNotices] = useState(new Map<string, Notice>());
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

/** Hidden retained screens must not report errors over another section. */
export function useBackgroundNotice({
  when,
  message,
  priority = 0,
  onRetry,
}: Notice & { when: boolean }) {
  const active = useScreenActive();
  const registry = useContext(Registry);
  const register = registry?.register;
  const id = useId();
  const retry = useRef(onRetry);
  useLayoutEffect(() => {
    retry.current = onRetry;
  });
  useEffect(() => {
    if (active && when && register)
      return register(id, {
        message,
        priority,
        onRetry: () => retry.current(),
      });
  }, [active, when, register, id, message, priority]);
}

export function BackgroundNoticeSlot() {
  const registry = useContext(Registry);
  const [retrying, setRetrying] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const notice = [...(registry?.notices.values() ?? [])].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  )[0];
  const visible = Boolean(notice);
  useLayoutEffect(() => {
    const host = slot.current;
    const panel = card.current;
    const main = host?.parentElement;
    if (!host || !panel || !main || !visible) return;
    // Main already ends above the app tabs. The club menu lives inside main;
    // measure its actual size, including safe area and responsive changes.
    let menu: Element | undefined;
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
          <StatusNoticeAction
            disabled={retrying}
            aria-busy={retrying}
            onClick={async () => {
              if (retrying) return;
              setRetrying(true);
              try {
                // One recovery action for coexisting session/content errors.
                await Promise.allSettled(
                  [...(registry?.notices.values() ?? [])].map(async (entry) =>
                    entry.onRetry(),
                  ),
                );
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? "Проверяем…" : "Повторить"}
          </StatusNoticeAction>
        }
      >
        {notice.message}
      </StatusNotice>
    </div>
  );
}
