"use client";
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

/** Add mouse swiping without intercepting native touch, wheel or keyboard input. */
export function useMouseDragScroll(enabled = true) {
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
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
      const cancel = () => finish(true);
      const visibility = () => {
        if (document.hidden) cancel();
      };
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
      const end = (endEvent: PointerEvent) => {
        if (endEvent.pointerId === drag.current?.id)
          finish(endEvent.type === "pointercancel");
      };
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
    onClickCapture: (event) => {
      if (event.detail && suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onLostPointerCapture: (event) => {
      if (event.pointerId === drag.current?.id) finish(true);
    },
    onDragStart: (event) => {
      if (drag.current) event.preventDefault();
    },
  } satisfies HTMLAttributes<HTMLDivElement>;
}
