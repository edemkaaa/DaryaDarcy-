"use client";
import { mergeStyles } from "@/shared/ui/css";
import {
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type UIEvent,
  type ReactNode,
} from "react";
import type { BoxProps } from "./types";
export type ScrollAreaProps = BoxProps & {
  contentStyle?: CSSProperties;
  contentClassName?: string;
  contentInert?: boolean;
  horizontal?: boolean;
  hideScrollbar?: boolean;
  paging?: boolean;
  snapInterval?: number;
  onScrollSettled?: (event: UIEvent<HTMLDivElement>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: ReactNode;
};
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    {
      contentStyle,
      contentClassName = "",
      contentInert,
      style,
      horizontal,
      hideScrollbar,
      paging,
      snapInterval,
      onScrollSettled,
      onRefresh,
      refreshing,
      children,
      className = "",
      onScroll,
      ...props
    },
    ref,
  ) {
    const node = useRef<HTMLDivElement | null>(null),
      settle = useRef<ReturnType<typeof setTimeout> | null>(null),
      pullStart = useRef<number | null>(null),
      refresh = useRef(onRefresh);
    refresh.current = onRefresh;
    useEffect(
      () => () => {
        if (settle.current) clearTimeout(settle.current);
      },
      [],
    );
    return (
      <div
        tabIndex={0}
        {...props}
        ref={(el) => {
          node.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        className={`ui-scroll ${horizontal ? "ui-scroll-horizontal" : ""} ${hideScrollbar ? "ui-scroll-hide" : ""} ${className}`}
        style={{
          ...style,
          ...(paging || snapInterval
            ? { scrollSnapType: horizontal ? "x mandatory" : "y mandatory" }
            : {}),
        }}
        onScroll={(e) => {
          onScroll?.(e);
          if (onScrollSettled) {
            if (settle.current) clearTimeout(settle.current);
            const el = e.currentTarget;
            settle.current = setTimeout(
              () => onScrollSettled({ ...e, currentTarget: el, target: el }),
              100,
            );
          }
        }}
        onTouchStart={(e) => {
          pullStart.current =
            !horizontal && e.currentTarget.scrollTop === 0
              ? e.touches[0]?.clientY
              : null;
          props.onTouchStart?.(e);
        }}
        onTouchEnd={(e) => {
          if (
            pullStart.current !== null &&
            e.changedTouches[0]?.clientY - pullStart.current > 80 &&
            !refreshing
          )
            refresh.current?.();
          pullStart.current = null;
          props.onTouchEnd?.(e);
        }}
      >
        {refreshing && (
          <div className="ui-refresh" role="status">
            Обновление…
          </div>
        )}
        <div
          inert={contentInert}
          className={`ui-stack ui-scroll-content ${horizontal ? "ui-scroll-content-horizontal" : ""} ${paging || snapInterval ? "ui-scroll-snap" : ""} ${contentClassName}`}
          style={mergeStyles(contentStyle)}
        >
          {children}
        </div>
      </div>
    );
  },
);
