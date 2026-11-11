"use client";
/** Единая область прокрутки связывает DOM-scroll, refs и измерения с API существующих экранов. */
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
import { useMouseDragScroll } from "@/shared/browser/use-mouse-drag-scroll";
export type ScrollAreaProps = BoxProps & {
  contentStyle?: CSSProperties;
  contentClassName?: string;
  contentInert?: boolean;
  horizontal?: boolean;
  /** Existing photo/video viewers keep their specialized paging gestures. */
  mouseDrag?: boolean;
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
      mouseDrag = true,
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
    const mouseSwiping = Boolean(horizontal && mouseDrag);
    const drag = useMouseDragScroll(mouseSwiping);
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
        data-horizontal-scroll={horizontal || undefined}
        onPointerDown={
          mouseSwiping
            ? (event) => {
                props.onPointerDown?.(event);
                if (!event.defaultPrevented) drag.onPointerDown(event);
              }
            : props.onPointerDown
        }
        onClickCapture={
          mouseSwiping
            ? (event) => {
                drag.onClickCapture(event);
                if (!event.isPropagationStopped())
                  props.onClickCapture?.(event);
              }
            : props.onClickCapture
        }
        onLostPointerCapture={
          mouseSwiping
            ? (event) => {
                drag.onLostPointerCapture(event);
                props.onLostPointerCapture?.(event);
              }
            : props.onLostPointerCapture
        }
        onDragStart={
          mouseSwiping
            ? (event) => {
                props.onDragStart?.(event);
                if (!event.defaultPrevented) drag.onDragStart(event);
              }
            : props.onDragStart
        }
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
