"use client";
/** Отслеживаем сдвиг касания, чтобы завершение прокрутки не запускало действие карточки; нативные жесты остаются браузеру. */

import { useEffect } from "react";

/** Observe touch movement without taking over native scroll, selection or pinch. */
export function TouchPressGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const pointers = new Set<number>();
    let touch: {
      id: number;
      x: number;
      y: number;
      canceled: boolean;
      endedAt: number | null;
    } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        root.removeAttribute("data-touch-press");
        touch = null;
        pointers.clear();
        return;
      }
      root.setAttribute("data-touch-press", "");
      if (!pointers.size)
        touch = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          canceled: false,
          endedAt: null,
        };
      else if (touch) touch.canceled = true;
      pointers.add(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse")
        root.removeAttribute("data-touch-press");
      if (
        touch?.id === event.pointerId &&
        Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10
      )
        touch.canceled = true;
    };
    const end = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId) || !touch) return;
      if (event.type === "pointercancel") touch.canceled = true;
      if (!pointers.size) touch.endedAt = event.timeStamp;
    };
    const keyboard = () => {
      root.removeAttribute("data-touch-press");
      touch = null;
      pointers.clear();
    };
    const touchEnd = (event: TouchEvent) => {
      // Native scrolling cancels pointer events before the finger is lifted.
      // Date the possible compatibility click from the actual end of the swipe.
      if (!event.touches.length && touch?.canceled)
        touch.endedAt = event.timeStamp;
    };
    const click = (event: MouseEvent) => {
      // Keyboard/programmatic clicks and actual mouse clicks keep their native
      // behavior. A fresh pointerdown always starts a new, independent tap.
      if (
        !event.detail ||
        ("pointerType" in event &&
          Boolean(event.pointerType) &&
          event.pointerType !== "touch") ||
        !touch?.canceled ||
        touch.endedAt === null ||
        event.timeStamp - touch.endedAt > 750 ||
        !(event.target instanceof Element) ||
        !event.target.closest("a,button,[role='button'],.ui-clickable-card")
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const observe = { capture: true, passive: true };
    document.addEventListener("pointerdown", down, observe);
    document.addEventListener("pointermove", move, observe);
    document.addEventListener("pointerup", end, observe);
    document.addEventListener("pointercancel", end, observe);
    document.addEventListener("touchend", touchEnd, observe);
    document.addEventListener("touchcancel", touchEnd, observe);
    document.addEventListener("keydown", keyboard, observe);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", end, true);
      document.removeEventListener("touchend", touchEnd, true);
      document.removeEventListener("touchcancel", touchEnd, true);
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("click", click, true);
      root.removeAttribute("data-touch-press");
    };
  }, []);
  return null;
}
