"use client";
/** Перетаскивание мышью дополняет горизонтальную прокрутку; отменённый drag не должен превращаться в обычное нажатие карточки. */
import { useCallback, useEffect, useRef, type HTMLAttributes } from "react";

type Drag = {
  id: number;
  node: HTMLDivElement;
  x: number;
  y: number;
  lastX: number;
  left: number;
  axis: "x" | "y" | null;
  snap: string;
  snapping: boolean;
  detach: () => void;
};

/** Считаем допустимые остановки по реальным дочерним карточкам и ширине прокрутки, убирая совпадающие крайние позиции. */
function snapOffsets(node: HTMLDivElement): number[] {
  const content = node.querySelector(":scope > .ui-scroll-content") ?? node;
  const items =
    content.querySelector(":scope > .ui-collection-horizontal") ?? content;
  const children = Array.from(items.children);
  const origin = children[0]?.getBoundingClientRect().left ?? 0;
  const max = Math.max(0, node.scrollWidth - node.clientWidth);
  return [
    ...new Set([
      0,
      ...children.map((child) =>
        Math.min(max, Math.max(0, child.getBoundingClientRect().left - origin)),
      ),
    ]),
  ].sort((a, b) => a - b);
}

/** Добавляем drag только левой мышью по нужному horizontal-root; touch, контролы медиа и редактирование текста остаются нативными. */
export function useMouseDragScroll(enabled = true) {
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  /** Завершаем listeners и pointer capture, возвращаем CSS snap и выбираем исходную либо ближайшую допустимую остановку. */
  const finish = useCallback((cancelled: boolean) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.detach();
    const { node } = current;
    if (current.axis) suppressClick.current = true;
    if (current.axis === "x") {
      const offset = node.scrollLeft;
      node.style.scrollSnapType = current.snap;
      delete node.dataset.mouseDragging;
      let left = cancelled ? current.left : offset;
      if (!cancelled && current.snapping) {
        const offsets = snapOffsets(node);
        /** Выбираем индекс ближайшей snap-позиции; порог отдельного swipe может сдвинуть его ещё на одну карточку. */
        const nearest = (value: number) =>
          offsets.reduce(
            (best, item, index) =>
              Math.abs(item - value) < Math.abs(offsets[best] - value)
                ? index
                : best,
            0,
          );
        const start = nearest(current.left);
        let next = nearest(offset);
        const distance = current.x - current.lastX;
        if (
          next === start &&
          Math.abs(distance) >
            Math.max(40, Math.min(node.clientWidth * 0.15, 100))
        )
          next += Math.sign(distance);
        left = offsets[Math.max(0, Math.min(offsets.length - 1, next))];
      }
      node.scrollTo({ left, behavior: "instant" });
    }
    if (node.hasPointerCapture(current.id))
      node.releasePointerCapture(current.id);
  }, []);

  useEffect(() => () => finish(true), [enabled, finish]);

  return {
    /** Новый mouse sequence начинает с чистого подавления click; чужие scroll-root и интерактивные контролы исключаются до захвата. */
    onPointerDown: (event) => {
      suppressClick.current = false;
      finish(true);
      suppressClick.current = false;
      const node = event.currentTarget;
      const target = event.target as Element;
      if (
        !enabled ||
        event.defaultPrevented ||
        event.pointerType !== "mouse" ||
        !event.isPrimary ||
        event.button !== 0 ||
        node.scrollWidth <= node.clientWidth + 1 ||
        target.closest("[data-horizontal-scroll]") !== node ||
        target.closest(
          "video,audio,iframe,input,textarea,select,[role=slider],[contenteditable]:not([contenteditable=false]),[data-no-mouse-drag]",
        )
      )
        return;
      /** Единая отмена возвращает исходный offset и снимает все listeners этой последовательности. */
      const cancel = () => finish(true);
      /** Уход документа в фон прекращает текущий drag, чтобы возврат не продолжил движение с устаревшими координатами. */
      const visibility = () => {
        if (document.hidden) cancel();
      };
      /** Захватываем указатель только после выбора горизонтальной оси; исчезновение элемента или отпускание кнопки отменяет операцию. */
      const move = (moveEvent: PointerEvent) => {
        const current = drag.current;
        if (!current || moveEvent.pointerId !== current.id) return;
        if (
          !node.isConnected ||
          !node.getClientRects().length ||
          !(moveEvent.buttons & 1)
        ) {
          cancel();
          return;
        }
        const dx = moveEvent.clientX - current.x,
          dy = moveEvent.clientY - current.y;
        if (!current.axis && Math.hypot(dx, dy) > 8) {
          current.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
          if (current.axis === "x") {
            node.setPointerCapture(current.id);
            node.style.scrollSnapType = "none";
            node.dataset.mouseDragging = "";
            const selection = window.getSelection();
            if (selection?.anchorNode && node.contains(selection.anchorNode))
              selection.removeAllRanges();
          }
        }
        current.lastX = moveEvent.clientX;
        if (current.axis === "x") {
          moveEvent.preventDefault();
          node.scrollLeft = current.left - dx;
        }
      };
      /** Завершаем только свой pointer; системная отмена возвращает исходную позицию вместо принятия нового scroll-offset. */
      const end = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === drag.current?.id)
          finish(endEvent.type === "pointercancel");
      };
      /** Снимаем все window/document listeners этой последовательности до удаления её состояния. */
      const detach = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        window.removeEventListener("blur", cancel);
        window.removeEventListener("resize", cancel);
        document.removeEventListener("visibilitychange", visibility);
      };
      drag.current = {
        id: event.pointerId,
        node,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        left: node.scrollLeft,
        axis: null,
        snap: node.style.scrollSnapType,
        snapping: getComputedStyle(node).scrollSnapType.startsWith("x"),
        detach,
      };
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("blur", cancel);
      window.addEventListener("resize", cancel);
      document.addEventListener("visibilitychange", visibility);
    },
    /** После распознанного drag подавляем только следующий pointer-click, оставляя клавиатурную активацию доступной. */
    onClickCapture: (event) => {
      if (event.detail && suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    /** Потерю нашего capture считаем отменой, а не принятием случайной новой позиции. */
    onLostPointerCapture: (event) => {
      if (event.pointerId === drag.current?.id) finish(true);
    },
    /** Во время своего drag не позволяем браузеру начать параллельное перетаскивание картинки или ссылки. */
    onDragStart: (event) => {
      if (drag.current) event.preventDefault();
    },
  } satisfies HTMLAttributes<HTMLDivElement>;
}
