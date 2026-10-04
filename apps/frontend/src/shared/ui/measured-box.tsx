"use client";
import { forwardRef, useLayoutEffect, useRef } from "react";
import type { BoxProps, LayoutRect } from "./types";
export const MeasuredBox = forwardRef<
  HTMLDivElement,
  BoxProps & {
    onResize?: (rect: LayoutRect) => void;
  }
>(function MeasuredBox({ onResize, className = "", ...props }, ref) {
  const node = useRef<HTMLDivElement | null>(null),
    callback = useRef(onResize);
  callback.current = onResize;
  useLayoutEffect(() => {
    const el = node.current;
    if (!el) return;
    const measure = () =>
      callback.current?.({
        x: el.offsetLeft,
        y: el.offsetTop,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      {...props}
      className={`ui-stack ${className}`}
      ref={(el) => {
        node.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
});
