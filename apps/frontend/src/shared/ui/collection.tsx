"use client";
import { mergeStyles } from "@/shared/ui/css";
import classes from "./collection.module.scss";
import React, {
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { VisibleItem } from "./types";
import { ScrollArea, type ScrollAreaProps } from "./scroll-area";
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
    contentStyle,
    horizontal,
    ...props
  }: CollectionProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const container = useRef<HTMLDivElement | null>(null),
    tail = useRef<HTMLDivElement | null>(null),
    body = useRef<HTMLDivElement | null>(null);
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
    [...body.current.children].forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [data, onVisibleItemsChange, visiblePercent, keyExtractor]);
  const groups: Array<readonly T[]> = [];
  for (let i = 0; i < data.length; i += columns)
    groups.push(data.slice(i, i + columns));
  return (
    <ScrollArea
      {...props}
      horizontal={horizontal}
      contentStyle={contentStyle}
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
                <div
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
                </div>
              ))
            : data.map((item, index) => (
                <React.Fragment key={keyExtractor?.(item, index) || index}>
                  <div
                    className="ui-stack ui-collection-item"
                    data-item-index={index}
                  >
                    {renderItem({ item, index })}
                  </div>
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
