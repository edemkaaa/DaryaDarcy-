"use client";
/** Окно коллекции освобождает далёкие карточки, но удерживает элементы с вводом, воспроизведением или выполняющейся операцией. */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";

const ItemWindow = createContext<{
  nearby: boolean;
  retain: () => () => void;
  measurements: Map<string, number>;
} | null>(null);

/** Keep intentional local state and ongoing work alive when its row leaves view. */
// Незавершённый ввод или медиасессия удерживают карточку, даже когда окно коллекции уходит дальше по списку.
/** Выдаём явный токен удержания карточки на время ввода или операции; очистка освобождает только этот токен. */
export function useCollectionItemRetention(retained: boolean) {
  const window = useContext(ItemWindow);
  const retain = window?.retain;
  useEffect(() => {
    if (retained) return retain?.();
    // Токен снимается при завершении работы или размонтировании вызывающего компонента.
  }, [retained, retain]);
  return window?.nearby ?? true;
}

/** Запоминаем высоту завершённого блока и резервируем её при повторном чтении вытесненных данных. */
export function useCollectionItemPlaceholder(key: string, pending: boolean) {
  const cache = useContext(ItemWindow)?.measurements;
  const ref = useRef<HTMLDivElement>(null);
  const [height] = useState(() => cache?.get(key));
  useLayoutEffect(() => {
    if (!cache || !ref.current || pending) return;
    const element = ref.current;
    /** Сохраняем фактическую высоту блока в локальном кеше карточки; ResizeObserver отключается при смене ключа или ожидания. */
    const measure = () =>
      cache.set(key, element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cache, key, pending]);
  return { ref, style: { minHeight: pending ? height : undefined } };
}

/** Оставляем далёкую строку измеренным spacer, но сохраняем React-состояние при фокусе, удержании или начатом воспроизведении. */
export function CollectionItemWindow({
  root,
  anchorLocked,
  epoch,
  index,
  className,
  style,
  children,
  itemKey,
  onRetentionChange,
}: {
  root: RefObject<HTMLDivElement | null>;
  anchorLocked: RefObject<boolean>;
  epoch: number;
  index: number;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  itemKey?: string;
  onRetentionChange?: (key: string, retained: boolean) => void;
}) {
  const active = useScreenActive();
  const activeRef = useRef(active);
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);
  const node = useRef<HTMLDivElement>(null);
  const measurements = useRef(new Map<string, number>());
  const [nearby, setNearby] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mediaActive, setMediaActive] = useState(false);
  const [retained, setRetained] = useState(false);
  const tokens = useRef(new Set<symbol>());
  /** Каждый потребитель получает отдельный Symbol; карточку можно освободить только после снятия всех удержаний. */
  const [retain] = useState(() => () => {
    const token = Symbol();
    tokens.current.add(token);
    setRetained(true);
    return () => {
      tokens.current.delete(token);
      setRetained(tokens.current.size > 0);
    };
  });
  const [measurement, setMeasurement] = useState({ height: 0, epoch: -1 });
  const previousHeight = useRef(0);
  const mounted =
    nearby || focused || retained || mediaActive || measurement.epoch !== epoch;
  const keepState = focused || retained || mediaActive;
  useLayoutEffect(() => {
    if (itemKey !== undefined) onRetentionChange?.(itemKey, keepState);
    // Сообщаем родительскому окну, какие данные нельзя вытеснить; cleanup снимает прежний ключ при смене карточки.
    return () => {
      if (itemKey !== undefined) onRetentionChange?.(itemKey, false);
    };
  }, [itemKey, onRetentionChange, keepState]);
  /** После pause/ended проверяем все плееры: пауза с ненулевой позицией тоже удерживает состояние воспроизведения. */
  const updateMediaRetention = () => {
    setMediaActive(
      [...(node.current?.querySelectorAll("video, audio") ?? [])].some(
        (element) => {
          const media = element as HTMLMediaElement;
          return !media.ended && (!media.paused || media.currentTime > 0);
        },
      ),
    );
  };

  // Removing a focused button (for example when it opens a player) does not
  // dispatch blur. Reconcile the real focus so the row cannot stay pinned.
  useLayoutEffect(() => {
    if (focused && !node.current?.contains(document.activeElement))
      setFocused(false);
  }, [focused, retained, mediaActive, mounted, measurement]);
  useEffect(() => {
    if (!focused) return;
    /** Сверяем настоящий activeElement, потому что удаление кнопки из DOM может не породить blur. */
    const checkFocus = () => {
      if (!node.current?.contains(document.activeElement)) setFocused(false);
    };
    document.addEventListener("focusin", checkFocus, true);
    return () => document.removeEventListener("focusin", checkFocus, true);
  }, [focused]);

  useLayoutEffect(() => {
    const element = node.current;
    const container =
      root.current ?? element?.closest<HTMLDivElement>(".ui-scroll");
    if (!element || !container || !mounted) return;
    // Измеряем смонтированную строку; изменение высоты над viewport компенсируем только вне заблокированной фазы якоря.
    /** Игнорируем нулевые размеры скрытой вкладки и обновляем spacer только по реальному layout текущей эпохи. */
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height <= 0 || container.clientHeight <= 0) return;
      const delta = height - previousHeight.current;
      const top =
        element.getBoundingClientRect().top -
        container.getBoundingClientRect().top;
      // Scroll anchoring is handled explicitly, including Safari and rotation.
      if (
        container.dataset.collectionScrollTarget !== "start" &&
        !anchorLocked.current &&
        previousHeight.current > 0 &&
        delta !== 0 &&
        top + previousHeight.current <= 0
      )
        container.scrollTop += delta;
      previousHeight.current = height;
      setMeasurement((current) =>
        current.height === height && current.epoch === epoch
          ? current
          : { height, epoch },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted, epoch, root, anchorLocked]);

  useEffect(() => {
    // display:none on a retained tab is not a user scrolling past every row.
    // Keep its last nearby window, including decoded photos and paused media.
    if (!active || !node.current || !root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (activeRef.current) setNearby(entry.isIntersecting);
      },
      { root: root.current, rootMargin: `${root.current.clientHeight * 2}px` },
    );
    observer.observe(node.current);
    return () => observer.disconnect();
  }, [active, root, epoch]);

  return (
    <div
      ref={node}
      className={className}
      style={{ ...style, height: mounted ? undefined : measurement.height }}
      data-item-index={index}
      data-item-key={itemKey}
      data-window-hidden={style?.display === "none" ? "" : undefined}
      data-window-mounted={mounted ? "true" : "false"}
      tabIndex={mounted ? undefined : 0}
      aria-label={mounted ? undefined : `Публикация ${index + 1}`}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        // Фокус внутри потомков всё ещё удерживает строку; освобождаем только при уходе за её границу.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false);
      }}
      onPlayCapture={() => setMediaActive(true)}
      onPauseCapture={updateMediaRetention}
      onEndedCapture={updateMediaRetention}
    >
      {mounted ? (
        <ItemWindow.Provider
          value={{ nearby, retain, measurements: measurements.current }}
        >
          {children}
        </ItemWindow.Provider>
      ) : null}
    </div>
  );
}
