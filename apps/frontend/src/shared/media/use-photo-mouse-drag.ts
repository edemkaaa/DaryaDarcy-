"use client";
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

/** Mouse dragging augments native touch/trackpad scrolling, never replaces it. */
export function usePhotoMouseDrag(width: number, count: number) {
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const finish = useCallback(
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
    const cancel = () => finish(true);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      cancel();
    };
  }, [finish]);

  const end = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (drag.current?.id === event.pointerId) finish(cancelled);
  };
  return {
    className: classes.draggable,
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
    onPointerUp: (event) => end(event, false),
    onPointerCancel: (event) => end(event, true),
    onLostPointerCapture: (event) => end(event, true),
    onClickCapture: (event) => {
      if (event.detail && suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  } satisfies HTMLAttributes<HTMLDivElement>;
}
