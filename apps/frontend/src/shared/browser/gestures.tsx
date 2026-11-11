"use client";
/** Адаптер жестов связывает существующие описания экранов с Pointer Events, учитывая захват указателя и отмену. */
import classes from "./gestures.module.scss";
import { mergeStyles, type StyleInput } from "@/shared/ui/css";
import {
  useRef,
  cloneElement,
  isValidElement,
  type ReactNode,
  type PointerEvent,
} from "react";
type GestureEvent = {
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
  absoluteX: number;
  absoluteY: number;
  x: number;
  y: number;
  scale: number;
};
type Handler = (event: GestureEvent) => void;
class PointerGesture {
  start?: Handler;
  update?: Handler;
  end?: Handler;
  cancel?: Handler;
  longPress = 0;
  taps = 1;
  offsetY?: number[];
  offsetX?: number[];
  constructor(public kind: "pan" | "pinch" | "tap") {}
  onStart(fn: Handler) {
    this.start = fn;
    return this;
  }
  onUpdate(fn: Handler) {
    this.update = fn;
    return this;
  }
  onEnd(fn: Handler) {
    this.end = fn;
    return this;
  }
  onCancel(fn: Handler) {
    this.cancel = fn;
    return this;
  }
  activateAfterLongPress(ms: number) {
    this.longPress = ms;
    return this;
  }
  numberOfTaps(n: number) {
    this.taps = n;
    return this;
  }
  activeOffsetY(v: number[] | number) {
    this.offsetY = typeof v === "number" ? [-Math.abs(v), Math.abs(v)] : v;
    return this;
  }
  failOffsetX(v: number[]) {
    this.offsetX = v;
    return this;
  }
}
export const Gesture = {
  Pan: () => new PointerGesture("pan"),
  Pinch: () => new PointerGesture("pinch"),
  Tap: () => new PointerGesture("tap"),
  Simultaneous: (...gestures: PointerGesture[]) => gestures,
};
export function GestureDetector({
  gesture,
  children,
  pointerTypes,
}: {
  gesture: PointerGesture | PointerGesture[];
  children: ReactNode;
  pointerTypes?: readonly string[];
}) {
  const state = useRef({
    points: new Map<
      number,
      {
        x: number;
        y: number;
      }
    >(),
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    startTime: 0,
    distance: 0,
    active: false,
    failed: false,
    taps: 0,
    tapTime: 0,
    timer: 0,
  });
  const gestures = Array.isArray(gesture) ? gesture : [gesture];
  const pan = gestures.find((g) => g.kind === "pan"),
    pinch = gestures.find((g) => g.kind === "pinch"),
    tap = gestures.find((g) => g.kind === "tap");
  const event = (e: PointerEvent): GestureEvent => {
    const s = state.current,
      dt = Math.max(1, performance.now() - s.lastTime);
    return {
      translationX: e.clientX - s.startX,
      translationY: e.clientY - s.startY,
      absoluteX: e.clientX,
      absoluteY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      velocityX: ((e.clientX - s.lastX) / dt) * 1000,
      velocityY: ((e.clientY - s.lastY) / dt) * 1000,
      scale: 1,
    };
  };
  return (
    <div
      onPointerDown={(e) => {
        if (pointerTypes && !pointerTypes.includes(e.pointerType)) return;
        const s = state.current;
        s.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (s.points.size === 1) {
          s.startX = s.lastX = e.clientX;
          s.startY = s.lastY = e.clientY;
          s.startTime = s.lastTime = performance.now();
          s.active = false;
          s.failed = false;
          if (pan?.longPress)
            s.timer = window.setTimeout(() => {
              s.active = true;
              pan.start?.(event(e));
            }, pan.longPress);
          else if (pan && !pan.offsetY) {
            s.active = true;
            pan.start?.(event(e));
          }
        }
        if (s.points.size === 2) {
          const [a, b] = [...s.points.values()];
          s.distance = Math.hypot(a.x - b.x, a.y - b.y);
        }
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const s = state.current;
        if (!s.points.has(e.pointerId)) return;
        s.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const data = event(e);
        if (s.points.size > 1 && pinch) {
          const [a, b] = [...s.points.values()];
          pinch.update?.({
            ...data,
            scale: Math.hypot(a.x - b.x, a.y - b.y) / (s.distance || 1),
          });
          return;
        }
        if (
          !s.failed &&
          pan?.offsetX &&
          (data.translationX < pan.offsetX[0] ||
            data.translationX > pan.offsetX[1])
        ) {
          s.failed = true;
          if (s.active) pan.cancel?.(data);
          s.active = false;
        }
        if (
          !s.failed &&
          !s.active &&
          pan?.offsetY &&
          (data.translationY < pan.offsetY[0] ||
            data.translationY > pan.offsetY[1])
        ) {
          s.active = true;
          pan.start?.(data);
        }
        if (s.active && !s.failed) pan?.update?.(data);
        else if (
          pan?.longPress &&
          Math.hypot(data.translationX, data.translationY) > 10
        ) {
          clearTimeout(s.timer);
          s.failed = true;
        }
        s.lastX = e.clientX;
        s.lastY = e.clientY;
        s.lastTime = performance.now();
      }}
      onPointerUp={(e) => {
        const s = state.current;
        if (!s.points.has(e.pointerId)) return;
        clearTimeout(s.timer);
        if (s.points.size > 1) pinch?.end?.(event(e));
        else if (s.active && !s.failed) pan?.end?.(event(e));
        else if (
          tap &&
          !s.failed &&
          performance.now() - s.startTime < 400 &&
          Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < 12
        ) {
          s.taps = performance.now() - s.tapTime < 350 ? s.taps + 1 : 1;
          s.tapTime = performance.now();
          if (s.taps >= tap.taps) {
            tap.end?.(event(e));
            s.taps = 0;
          }
        }
        s.points.delete(e.pointerId);
      }}
      onPointerCancel={(e) => {
        if (!state.current.points.has(e.pointerId)) return;
        if (state.current.active && !state.current.failed)
          pan?.cancel?.(event(e));
        clearTimeout(state.current.timer);
        state.current.points.delete(e.pointerId);
        state.current.active = false;
      }}
      onLostPointerCapture={(e) => {
        if (!state.current.points.has(e.pointerId)) return;
        if (state.current.active && !state.current.failed)
          pan?.cancel?.(event(e));
        clearTimeout(state.current.timer);
        state.current.points.delete(e.pointerId);
        state.current.active = false;
      }}
      className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
    >
      {isValidElement<{
        style?: unknown;
      }>(children)
        ? cloneElement(children, {
            style: (
              children.type as {
                supportsMotionStyles?: boolean;
              }
            ).supportsMotionStyles
              ? [
                  children.props.style,
                  {
                    touchAction: pinch
                      ? "none"
                      : pan?.offsetY
                        ? "pan-x"
                        : "none",
                  },
                ]
              : mergeStyles(children.props.style as StyleInput, {
                  touchAction: pinch ? "none" : pan?.offsetY ? "pan-x" : "none",
                }),
          })
        : children}
    </div>
  );
}
