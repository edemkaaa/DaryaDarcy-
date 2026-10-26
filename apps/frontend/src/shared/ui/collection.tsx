"use client";
import { mergeStyles } from "@/shared/ui/css";
import classes from "./collection.module.scss";
import React, {
  forwardRef,
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
  loadMoreThreshold?: number;
  onVisibleItemsChange?: (info: { visibleItems: VisibleItem<T>[] }) => void;
  visiblePercent?: number;
  /** Fade in the first loaded items, without moving them or replaying on return. */
  revealItems?: boolean;
  /** Release measured offscreen rows while preserving explicit interaction state. */
  windowItems?: boolean;
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
    loadMoreThreshold = 0.5,
    onVisibleItemsChange,
    visiblePercent = 50,
    revealItems = false,
    windowItems = false,
    contentStyle,
    horizontal,
    ...props
  }: CollectionProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const container = useRef<HTMLDivElement | null>(null),
    tail = useRef<HTMLDivElement | null>(null),
    body = useRef<HTMLDivElement | null>(null);
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
      const items = element.querySelectorAll("[data-window-mounted]");
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
  const visible = useRef(onVisibleItemsChange);
  visible.current = onVisibleItemsChange;
  useEffect(() => {
    if (!tail.current || !container.current || !onLoadMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load.current?.();
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
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= visiblePercent / 100
          )
            items.set(index, {
              item: data[index],
              index,
              key: keyExtractor?.(data[index], index) || String(index),
              isVisible: true,
            });
          else items.delete(index);
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
  }, [data, onVisibleItemsChange, visiblePercent, keyExtractor]);
  const groups: Array<readonly T[]> = [];
  for (let i = 0; i < data.length; i += columns)
    groups.push(data.slice(i, i + columns));
  return (
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
                  key={row}
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
            : data.map((item, index) => (
                <React.Fragment key={keyExtractor?.(item, index) || index}>
                  {windowItems ? (
                    <CollectionItemWindow
                      root={container}
                      anchorLocked={anchorLocked}
                      epoch={windowEpoch}
                      index={index}
                      className="ui-stack ui-collection-item"
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
    <div className={props.className} style={props.style}>
      {props.children}
    </div>
  );
}
