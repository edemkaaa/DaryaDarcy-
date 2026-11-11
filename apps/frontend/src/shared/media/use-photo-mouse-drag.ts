"use client";
/** Горизонтальный drag мышью согласован с навигацией фотографий и подавлением случайного открытия после перетаскивания. */
import {
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
import { scrollPhotoTo } from "./photo-carousel-navigation";
import classes from "./photo-navigation.module.scss";

type Drag = {
  id: number;
  node: HTMLDivElement;
  x: number;
  y: number;
  lastX: number;
  left: number;
  width: number;
  snap: string;
  moved: boolean;
  horizontal: boolean;
};

/** Дополняем нативный touch/trackpad drag-жестом мыши и после движения подавляем только порождённый им клик. */
export function usePhotoMouseDrag(width: number, count: number) {
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const finish = useCallback(
    /** Возвращаем snap и pointer capture на любом завершении; отмена возвращает исходный кадр, уверенный горизонтальный жест выбирает соседний. */
    (cancelled: boolean) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      const { node, id } = current;
      if (current.moved) {
        suppressClick.current = true;
        node.style.scrollSnapType = current.snap;
        delete node.dataset.photoDragging;
        let index = Math.round(current.left / current.width);
        if (!cancelled && current.horizontal) {
          const distance = current.x - current.lastX;
          const nearest = Math.round(node.scrollLeft / current.width);
          if (
            Math.abs(distance) >
            Math.max(40, Math.min(current.width * 0.18, 120))
          )
            index = nearest === index ? index + Math.sign(distance) : nearest;
        }
        scrollPhotoTo(node, current.width, count, index);
      }
      if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
    },
    [count],
  );

  useEffect(() => {
    // Losing the window or resizing it must not leave capture/snap disabled.
    /** Потеря окна, resize и cleanup завершают жест одинаково, не оставляя отключённый scroll-snap. */
    const cancel = () => finish(true);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      cancel();
    };
  }, [finish]);

  /** Завершение чужого pointerId не должно прервать активное перетаскивание этой карусели. */
  const end = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (drag.current?.id === event.pointerId) finish(cancelled);
  };
  return {
    className: classes.draggable,
    /** Начинаем только основной кнопкой мыши и при известной ширине; касания остаются нативной прокруткой. */
    onPointerDown: (event) => {
      suppressClick.current = false;
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        width <= 0 ||
        count < 2
      )
        return;
      drag.current = {
        id: event.pointerId,
        node: event.currentTarget,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        left: event.currentTarget.scrollLeft,
        width,
        snap: event.currentTarget.style.scrollSnapType,
        moved: false,
        horizontal: false,
      };
    },
    /** После порога отличаем горизонтальный drag от вертикального движения, захватываем указатель и временно отключаем snap. */
    onPointerMove: (event) => {
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      if (!current.moved && Math.hypot(dx, dy) > 8) {
        current.moved = true;
        current.horizontal = Math.abs(dx) >= Math.abs(dy);
        current.node.setPointerCapture(event.pointerId);
        current.node.style.scrollSnapType = "none";
        current.node.dataset.photoDragging = "";
      }
      if (current.moved) {
        event.preventDefault();
        current.lastX = event.clientX;
        if (current.horizontal) current.node.scrollLeft = current.left - dx;
      }
    },
    /** Обычное отпускание может переключить кадр в направлении достаточного горизонтального жеста. */
    onPointerUp: (event) => end(event, false),
    /** Отмена браузером возвращает исходный кадр и восстанавливает настройки области. */
    onPointerCancel: (event) => end(event, true),
    /** Потеря capture проходит через ту же безопасную отмену активного указателя. */
    onLostPointerCapture: (event) => end(event, true),
    /** Подавляем один мышиный клик после drag, но сохраняем клавиатурную активацию detail=0. */
    onClickCapture: (event) => {
      if (event.detail && suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  } satisfies HTMLAttributes<HTMLDivElement>;
}
