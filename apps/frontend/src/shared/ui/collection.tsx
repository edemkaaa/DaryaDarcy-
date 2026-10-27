"use client";
import { mergeStyles } from "@/shared/ui/css";
import classes from "./collection.module.scss";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { VisibleItem } from "./types";
import { ScrollArea, type ScrollAreaProps } from "./scroll-area";
import { CollectionItemWindow } from "./collection-item-window";
type Slot = ReactNode | (() => ReactNode);
const slot = (value: Slot) => (typeof value === "function" ? value() : value);
type CollectionProps<T> = Omit<ScrollAreaProps, "children"> & {
  data?: readonly T[];
  renderItem: (args: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  header?: Slot;
  footer?: Slot;
  empty?: Slot;
  divider?: Slot;
  columns?: number;
  rowStyle?: CSSProperties;
  rowClassName?: string;
  onLoadMore?: () => void;
  onLoadPrevious?: () => void;
  loadMoreThreshold?: number;
  onVisibleItemsChange?: (info: { visibleItems: VisibleItem<T>[] }) => void;
  visiblePercent?: number;
  /** Fade in the first loaded items, without moving them or replaying on return. */
  revealItems?: boolean;
  /** Release measured offscreen rows while preserving explicit interaction state. */
  windowItems?: boolean;
  retentionKey?: string;
};
function CollectionInner<T>(
  {
    data = [],
    renderItem,
    keyExtractor,
    header,
    footer,
    empty,
    divider,
    columns = 1,
    rowStyle,
    rowClassName = "",
    onLoadMore,
    onLoadPrevious,
    loadMoreThreshold = 0.5,
    onVisibleItemsChange,
    visiblePercent = 50,
    revealItems = false,
    windowItems = false,
    retentionKey,
    contentStyle,
    horizontal,
    ...props
  }: CollectionProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const container = useRef<HTMLDivElement | null>(null),
    tail = useRef<HTMLDivElement | null>(null),
    head = useRef<HTMLDivElement | null>(null),
    body = useRef<HTMLDivElement | null>(null);
  // Keep only explicit drafts/media state outside the data window. Hidden rows
  // retain their React identity and reappear when their page is loaded again.
  const knownItems = useRef(new Map<string, T>());
  const [retention, setRetention] = useState<{
    scope: string | undefined;
    keys: Set<string>;
  }>({ scope: retentionKey, keys: new Set() });
  const onRetentionChange = useCallback(
    (key: string, retained: boolean) => {
      setRetention((current) => {
        const keys =
          current.scope === retentionKey ? current.keys : new Set<string>();
        if (keys.has(key) === retained && current.scope === retentionKey)
          return current;
        const next = new Set(keys);
        if (retained) next.add(key);
        else next.delete(key);
        return { scope: retentionKey, keys: next };
      });
    },
    [retentionKey],
  );
  const currentKeys = new Set(
    data.map((item, index) => keyExtractor?.(item, index) ?? String(index)),
  );
  const retainedItems =
    retention.scope === retentionKey && columns === 1
      ? [...retention.keys]
          .filter((key) => !currentKeys.has(key) && knownItems.current.has(key))
          .map((key) => ({ key, item: knownItems.current.get(key)! }))
      : [];
  useLayoutEffect(() => {
    const next = new Map<string, T>();
    data.forEach((item, index) =>
      next.set(keyExtractor?.(item, index) ?? String(index), item),
    );
    if (retention.scope === retentionKey)
      for (const key of retention.keys) {
        const item = knownItems.current.get(key);
        if (item !== undefined && !next.has(key)) next.set(key, item);
      }
    knownItems.current = next;
  }, [data, keyExtractor, retention, retentionKey]);
  const itemsShown = useRef(false);
  const [windowEpoch, setWindowEpoch] = useState(0);
  const anchorLocked = useRef(false);
  const anchor = useRef<{
    element?: Element;
    offset: number;
    end: boolean;
  } | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!windowItems || !element) return;
    let previous = `${element.clientWidth}:${element.clientHeight}`;
    const captureAnchor = () => {
      if (element.scrollTop < 1) delete element.dataset.collectionScrollTarget;
      if (`${element.clientWidth}:${element.clientHeight}` !== previous) return;
      const items = element.querySelectorAll(
        "[data-window-mounted]:not([data-window-hidden])",
      );
      const top = element.getBoundingClientRect().top;
      let lower = 0,
        upper = items.length;
      while (lower < upper) {
        const middle = Math.floor((lower + upper) / 2);
        if (items[middle].getBoundingClientRect().bottom <= top)
          lower = middle + 1;
        else upper = middle;
      }
      const item = items[lower];
      anchor.current = {
        element: item,
        offset: item ? item.getBoundingClientRect().top - top : 0,
        end:
          element.scrollHeight - element.clientHeight - element.scrollTop < 2,
      };
    };
    const interruptScrollTarget = () => {
      delete element.dataset.collectionScrollTarget;
    };
    captureAnchor();
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
      element.addEventListener(event, interruptScrollTarget, { passive: true });
    element.addEventListener("scroll", captureAnchor, { passive: true });
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return;
      const size = `${element.clientWidth}:${element.clientHeight}`;
      if (size !== previous) {
        previous = size;
        anchorLocked.current = true;
        setWindowEpoch((epoch) => epoch + 1);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", captureAnchor);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"])
        element.removeEventListener(event, interruptScrollTarget);
    };
  }, [windowItems]);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element || !anchorLocked.current) return;
    const saved =
      element.dataset.collectionScrollTarget === "start"
        ? null
        : anchor.current;
    if (saved?.end) element.scrollTop = element.scrollHeight;
    else if (saved?.element?.isConnected) {
      const bounds = saved.element.getBoundingClientRect();
      const offset = Math.max(saved.offset, -bounds.height + 1);
      element.scrollTop +=
        bounds.top - element.getBoundingClientRect().top - offset;
    }
    anchorLocked.current = false;
  }, [windowEpoch]);
  useLayoutEffect(() => {
    const element = body.current;
    if (!revealItems || !element || itemsShown.current) return;
    itemsShown.current = true;
    if (
      !element.animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const reveal = element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
    return () => reveal.cancel();
  }, [data.length, revealItems]);
  const load = useRef(onLoadMore);
  load.current = onLoadMore;
  const previousLoad = useRef(onLoadPrevious);
  previousLoad.current = onLoadPrevious;
  useEffect(() => {
    if (!head.current || !container.current || !onLoadPrevious) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) previousLoad.current?.();
      },
      { root: container.current, rootMargin: "100px" },
    );
    observer.observe(head.current);
    return () => observer.disconnect();
  }, [data, onLoadPrevious]);
  const visible = useRef(onVisibleItemsChange);
  visible.current = onVisibleItemsChange;
  useEffect(() => {
    if (!tail.current || !container.current || !onLoadMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          container.current?.dataset.collectionScrollTarget !== "start"
        )
          load.current?.();
      },
      {
        root: container.current,
        rootMargin: `${Math.round(container.current.clientHeight * loadMoreThreshold)}px`,
      },
    );
    obs.observe(tail.current);
    return () => obs.disconnect();
  }, [data.length, onLoadMore, loadMoreThreshold]);
  useEffect(() => {
    if (!body.current || !container.current || !onVisibleItemsChange) return;
    const items = new Map<number, VisibleItem<T>>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.itemIndex);
          for (
            let offset = 0;
            offset < columns && index + offset < data.length;
            offset++
          ) {
            const itemIndex = index + offset;
            if (
              entry.isIntersecting &&
              entry.intersectionRect.height > 0 &&
              entry.intersectionRatio >= visiblePercent / 100
            )
              items.set(itemIndex, {
                item: data[itemIndex],
                index: itemIndex,
                key:
                  keyExtractor?.(data[itemIndex], itemIndex) ||
                  String(itemIndex),
                isVisible: true,
              });
            else items.delete(itemIndex);
          }
        }
        visible.current?.({
          visibleItems: [...items.values()].sort((a, b) => a.index - b.index),
        });
      },
      { root: container.current, threshold: visiblePercent / 100 },
    );
    // Dividers are siblings of rows and do not represent collection items.
    [...body.current.children].forEach((el) => {
      if (el.hasAttribute("data-item-index")) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [data, columns, onVisibleItemsChange, visiblePercent, keyExtractor]);
  const groups: Array<readonly T[]> = [];
  for (let i = 0; i < data.length; i += columns)
    groups.push(data.slice(i, i + columns));
  return (
    <CollectionScrollAnchor
      root={container}
      data={data}
      itemKeys={[...currentKeys]}
    >
      <ScrollArea
        {...props}
        horizontal={horizontal}
        data-windowed-collection={windowItems ? "" : undefined}
        contentStyle={contentStyle}
        style={{
          ...props.style,
          ...(windowItems ? { overflowAnchor: "none" } : {}),
        }}
        ref={(el) => {
          container.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
      >
        {slot(header)}
        <div ref={head} aria-hidden className={classes.div} />
        {!data.length ? (
          slot(empty)
        ) : (
          <div
            ref={body}
            className={`ui-stack ${horizontal ? "ui-collection-horizontal" : ""}`}
          >
            {columns > 1
              ? groups.map((group, row) => (
                  <CollectionRow
                    windowed={windowItems}
                    root={container}
                    anchorLocked={anchorLocked}
                    epoch={windowEpoch}
                    index={row * columns}
                    className={`ui-stack ui-collection-row ${rowClassName}`}
                    key={keyExtractor?.(group[0], row * columns) ?? row}
                    style={mergeStyles(rowStyle)}
                  >
                    {group.map((item, column) => (
                      <React.Fragment
                        key={
                          keyExtractor?.(item, row * columns + column) ||
                          row * columns + column
                        }
                      >
                        {renderItem({ item, index: row * columns + column })}
                      </React.Fragment>
                    ))}
                  </CollectionRow>
                ))
              : [
                  ...data.map((item, index) => ({
                    item,
                    key: keyExtractor?.(item, index) ?? String(index),
                    hidden: false,
                  })),
                  ...retainedItems.map((entry) => ({ ...entry, hidden: true })),
                ].map(({ item, key, hidden }, index) => (
                  <React.Fragment key={key}>
                    {windowItems ? (
                      <CollectionItemWindow
                        root={container}
                        anchorLocked={anchorLocked}
                        epoch={windowEpoch}
                        index={index}
                        className="ui-stack ui-collection-item"
                        itemKey={key}
                        onRetentionChange={
                          retentionKey === undefined
                            ? undefined
                            : onRetentionChange
                        }
                        style={hidden ? { display: "none" } : undefined}
                      >
                        {renderItem({ item, index })}
                      </CollectionItemWindow>
                    ) : (
                      <div
                        className="ui-stack ui-collection-item"
                        data-item-index={index}
                      >
                        {renderItem({ item, index })}
                      </div>
                    )}
                    {index < data.length - 1 ? slot(divider) : null}
                  </React.Fragment>
                ))}
          </div>
        )}
        {slot(footer)}
        <div ref={tail} aria-hidden className={classes.div} />
      </ScrollArea>
    </CollectionScrollAnchor>
  );
}
export const Collection = forwardRef(CollectionInner) as <T>(
  props: CollectionProps<T> & {
    ref?: React.Ref<HTMLDivElement>;
  },
) => React.ReactElement;

function CollectionRow({
  windowed,
  ...props
}: React.ComponentProps<typeof CollectionItemWindow> & { windowed: boolean }) {
  if (windowed) return <CollectionItemWindow {...props} />;
  return (
    <div
      className={props.className}
      style={props.style}
      data-item-index={props.index}
    >
      {props.children}
    </div>
  );
}

type ScrollSnapshot = { element: Element; offset: number }[] | null;
/** Capture before React changes the DOM; keep the first surviving visible row
 * in place when pages are prepended, removed, or revalidated. */
class CollectionScrollAnchor extends React.Component<{
  root: React.RefObject<HTMLDivElement | null>;
  data: readonly unknown[];
  itemKeys: readonly string[];
  children: ReactNode;
}> {
  getSnapshotBeforeUpdate(
    previous: Readonly<typeof this.props>,
  ): ScrollSnapshot {
    const root = this.props.root.current;
    if (
      previous.data === this.props.data ||
      !root ||
      (root.scrollTop <= 0 &&
        this.props.itemKeys.indexOf(previous.itemKeys[0]) <= 0) ||
      root.dataset.collectionScrollTarget === "start"
    )
      return null;
    const top = root.getBoundingClientRect().top;
    return [...root.querySelectorAll("[data-item-index]")]
      .filter((row) => row.getBoundingClientRect().bottom > top)
      .slice(0, 4)
      .map((element) => ({
        element,
        offset: element.getBoundingClientRect().top - top,
      }));
  }
  componentDidUpdate(
    _previous: Readonly<typeof this.props>,
    _state: unknown,
    snapshot: ScrollSnapshot,
  ) {
    const root = this.props.root.current;
    const anchor = snapshot?.find(
      ({ element }) =>
        element.isConnected && element.getBoundingClientRect().height > 0,
    );
    if (root && anchor)
      root.scrollTop +=
        anchor.element.getBoundingClientRect().top -
        root.getBoundingClientRect().top -
        anchor.offset;
  }
  render() {
    return this.props.children;
  }
}
