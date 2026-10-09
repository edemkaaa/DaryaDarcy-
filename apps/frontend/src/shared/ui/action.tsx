"use client";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ButtonHTMLAttributes,
} from "react";
import { mergeStyles, type StyleInput } from "./css";
type ActionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "style" | "className"
> & {
  className?:
    | string
    | ((state: {
        pressed: boolean;
        hovered: boolean;
        focused: boolean;
      }) => string);
  style?:
    | CSSProperties
    | ((state: {
        pressed: boolean;
        hovered: boolean;
        focused: boolean;
      }) => StyleInput);
  onHold?: () => void;
  holdDelay?: number;
  activeOpacity?: number;
  hitArea?: number;
};
export const Action = forwardRef<HTMLButtonElement, ActionProps>(
  function Action(
    {
      style,
      className = "",
      onHold,
      holdDelay = 500,
      activeOpacity = 0.8,
      hitArea,
      children,
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerMove,
      onPointerCancel,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) {
    const [pressed, setPressed] = useState(false),
      [hovered, setHovered] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
      held = useRef(false);
    const baseOpacity = useRef(1);
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const cancel = () => {
      setPressed(false);
      if (timer.current) clearTimeout(timer.current);
    };
    useEffect(
      () => () => {
        if (timer.current) clearTimeout(timer.current);
      },
      [],
    );
    const actual =
      typeof style === "function"
        ? mergeStyles(style({ pressed, hovered, focused: false }))
        : style;
    const actualClassName =
      typeof className === "function"
        ? className({ pressed, hovered, focused: false })
        : className;
    return (
      <button
        ref={ref}
        type="button"
        data-hit-area={hitArea ? true : undefined}
        {...props}
        className={`ui-action ${actualClassName}`}
        style={{
          ...actual,
          ...(hitArea
            ? ({ "--hit-area": `${hitArea}px` } as CSSProperties)
            : {}),
          ...(pressed
            ? {
                opacity:
                  actual?.opacity === undefined
                    ? `calc(var(--action-base-opacity, ${baseOpacity.current}) * ${activeOpacity})`
                    : Number(actual.opacity) * activeOpacity,
              }
            : {}),
        }}
        onClick={(e) => {
          if (onClick) e.stopPropagation();
          if (!held.current || !e.detail) onClick?.(e);
          held.current = false;
        }}
        onPointerDown={(e) => {
          baseOpacity.current = Number(
            getComputedStyle(e.currentTarget).opacity,
          );
          // Touch taps retain the action, but never dim/scale a card while the
          // browser is still deciding whether this is a scrolling gesture.
          setPressed(e.pointerType !== "touch");
          touchStart.current =
            e.pointerType === "touch" ? { x: e.clientX, y: e.clientY } : null;
          held.current = false;
          if (onHold)
            timer.current = setTimeout(() => {
              held.current = true;
              onHold();
            }, holdDelay);
          onPointerDown?.(e);
        }}
        onPointerMove={(e) => {
          const start = touchStart.current;
          if (
            start &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10
          ) {
            cancel();
            held.current = true;
          }
          onPointerMove?.(e);
        }}
        onPointerUp={(e) => {
          cancel();
          touchStart.current = null;
          onPointerUp?.(e);
        }}
        onPointerCancel={(e) => {
          cancel();
          touchStart.current = null;
          held.current = true;
          onPointerCancel?.(e);
        }}
        onMouseEnter={(e) => {
          setHovered(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          cancel();
          setHovered(false);
          onMouseLeave?.(e);
        }}
      >
        {children}
      </button>
    );
  },
);
