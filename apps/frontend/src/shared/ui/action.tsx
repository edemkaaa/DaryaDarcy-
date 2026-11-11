"use client";
/** Кнопка объединяет DOM-семантику, disabled, фокус и обратную связь на нажатие для всех экранов. */
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
  pressFeedback?: boolean;
  hitArea?: number;
};
export const Action = forwardRef<HTMLButtonElement, ActionProps>(
  /** Объединяем клик и удержание в нативной кнопке; завершённое удержание подавляет последующий мышиный клик, но не клавиатурный. */
  function Action(
    {
      style,
      className = "",
      onHold,
      holdDelay = 500,
      activeOpacity = 0.8,
      pressFeedback = true,
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
    /** Снимаем визуальное нажатие и таймер удержания; решение о подавлении клика принимает конкретное событие указателя. */
    const cancel = () => {
      setPressed(false);
      if (timer.current) clearTimeout(timer.current);
    };
    useEffect(
      // Таймер принадлежит экземпляру кнопки: после размонтирования удержание вызывать нельзя.
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
          // После удержания не дублируем действие кликом; detail=0 сохраняет клавиатурную активацию.
          if (onClick) e.stopPropagation();
          if (!held.current || !e.detail) onClick?.(e);
          held.current = false;
        }}
        onPointerDown={(e) => {
          // Запоминаем начало жеста; на touch не затемняем карточку до решения браузера о прокрутке.
          baseOpacity.current = Number(
            getComputedStyle(e.currentTarget).opacity,
          );
          // Touch taps retain the action, but never dim/scale a card while the
          // browser is still deciding whether this is a scrolling gesture.
          setPressed(
            pressFeedback &&
              e.pointerType !== "touch" &&
              !e.currentTarget.closest("[data-horizontal-scroll]"),
          );
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
          // Движение пальца дальше порога отменяет удержание и подавляет случайный клик после прокрутки.
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
          // Отпускание очищает таймер и начало касания, затем передаёт событие вызывающему коду.
          cancel();
          touchStart.current = null;
          onPointerUp?.(e);
        }}
        onPointerCancel={(e) => {
          // Отмена браузером не должна превращаться в клик; сбрасываем жест и отмечаем его использованным.
          cancel();
          touchStart.current = null;
          held.current = true;
          onPointerCancel?.(e);
        }}
        onMouseEnter={(e) => {
          // Поддерживаем состояние hover независимо от нажатия и вызываем внешний обработчик.
          setHovered(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          // Выход курсора отменяет удержание и снимает hover, чтобы кнопка не оставалась нажатой.
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
