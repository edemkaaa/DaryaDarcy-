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
          if (!held.current) onClick?.(e);
          held.current = false;
        }}
        onPointerDown={(e) => {
          baseOpacity.current = Number(
            getComputedStyle(e.currentTarget).opacity,
          );
          setPressed(true);
          held.current = false;
          if (onHold)
            timer.current = setTimeout(() => {
              held.current = true;
              onHold();
            }, holdDelay);
          onPointerDown?.(e);
        }}
        onPointerUp={(e) => {
          cancel();
          onPointerUp?.(e);
        }}
        onPointerCancel={(e) => {
          cancel();
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
