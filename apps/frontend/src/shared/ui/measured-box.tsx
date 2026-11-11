"use client";
/** Изменение DOM-размеров сообщается владельцу компонента через измерение, а не предположение о геометрии экрана. */
import { forwardRef, useLayoutEffect, useRef } from "react";
import type { BoxProps, LayoutRect } from "./types";
export const MeasuredBox = forwardRef<
  HTMLDivElement,
  BoxProps & {
    onResize?: (rect: LayoutRect) => void;
  }
/** Сообщаем текущему обработчику размеры элемента при первом layout и ResizeObserver; ref доступен также внешнему владельцу. */
>(function MeasuredBox({ onResize, className = "", ...props }, ref) {
  const node = useRef<HTMLDivElement | null>(null),
    callback = useRef(onResize);
  callback.current = onResize;
  useLayoutEffect(() => {
    // Наблюдение создаётся на DOM-узел один раз; актуальный onResize читается через callback ref.
    const el = node.current;
    if (!el) return;
    /** Передаём положение относительно offsetParent и видимые размеры из DOM, не смешивая их с координатами окна. */
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
        // Один узел сохраняем для внутренних измерений и одновременно передаём внешнему ref.
        node.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
    />
  );
});
