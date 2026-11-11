"use client";
/** Совместимый слой анимаций переводит используемые экраном значения и эффекты в DOM-стили и браузерный жизненный цикл. */
import { mergeStyles, type StyleInput } from "@/shared/ui/css";
import {
  MeasuredBox,
  Typography,
  ScrollArea,
  DomImage,
} from "@/shared/ui/elements";
/** Browser motion engine: requestAnimationFrame values and Web Animations entrances. */
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type Ref,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  type RefAttributes,
  type UIEvent,
} from "react";
type Listener = () => void;
let collect: Set<Value> | null = null;
type Animation = {
  kind: "timing" | "spring" | "delay" | "sequence" | "repeat";
  to?: number;
  duration?: number;
  easing?: (t: number) => number;
  callback?: (finished: boolean) => void;
  delay?: number;
  items?: Animation[];
  animation?: Animation;
  count?: number;
  reverse?: boolean;
};
/** Animation descriptor распознаётся по kind; это внутренний объект совместимого API, который type cast представляет как value. */
const animation = (v: unknown): v is Animation =>
  !!v && typeof v === "object" && "kind" in v;
export interface SharedValue<T> {
  value: T;
}
/** Значение удерживает подписчиков и текущую анимацию; чтение во время сбора зависимостей регистрирует потребителя. */
class Value implements SharedValue<number> {
  private current: number;
  private listeners = new Set<Listener>();
  private stop?: () => void;
  /** Начальное значение устанавливается без анимации и без уведомления ещё не подключённых подписчиков. */
  constructor(value: number) {
    this.current = value;
  }
  /** Во время computations чтение добавляет Value в набор зависимостей, после чего возвращает текущее число. */
  get value(): number {
    collect?.add(this);
    return this.current;
  }
  /** Новая запись останавливает прежнюю анимацию; descriptor запускает play, обычное значение применяется сразу. */
  set value(value: number) {
    this.stop?.();
    if (animation(value)) this.stop = play(this, value);
    else this.update(value);
  }
  /** Уведомляем только при реальном изменении значения, чтобы одинаковые кадры не дублировали DOM-обновления. */
  update(value: number) {
    if (Object.is(this.current, value)) return;
    this.current = value;
    this.listeners.forEach((fn) => fn());
  }
  /** Возвращаем точечную отписку: несколько стилей или реакций могут независимо наблюдать один Value. */
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  /** Останавливаем текущую цепочку и убираем её cancel-handle, сохраняя последнее уже показанное значение. */
  stopAnimation() {
    this.stop?.();
    this.stop = undefined;
  }
}
/** Выполняем timing/spring или композицию delay/sequence/repeat; cancel рекурсивно останавливает frame, timer и дочерний запуск. */
function play(
  value: Value,
  a: Animation,
  complete: () => void = () => {},
): () => void {
  let stopped = false,
    frame = 0,
    timer = 0,
    cancelChild: () => void = () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced && a.kind === "repeat") return () => {};
  /** Callback и продолжение вызываются только при штатном завершении, а не после отмены текущей ветки. */
  const finish = () => {
    if (!stopped) {
      a.callback?.(true);
      complete();
    }
  };
  if (a.kind === "delay")
    timer = window.setTimeout(() => {
      cancelChild = play(value, a.animation!, finish);
    }, a.delay);
  else if (a.kind === "sequence") {
    let index = 0;
    /** После штатного завершения шага запускаем следующий; остановленная последовательность дальше не планируется. */
    const step = () => {
      if (stopped) return;
      if (index === a.items!.length) finish();
      else cancelChild = play(value, a.items![index++], step);
    };
    step();
  } else if (a.kind === "repeat") {
    let index = 0;
    const initial = value.value;
    /** Перед повтором проверяем отмену и число итераций; reverse меняет цель очередной копии descriptor. */
    const step = () => {
      if (stopped) return;
      if (a.count !== -1 && index >= (a.count || 2)) {
        finish();
        return;
      }
      const next = { ...a.animation! };
      if (a.reverse && index % 2) next.to = initial;
      index++;
      cancelChild = play(value, next, step);
    };
    step();
  } else {
    const from = value.value,
      to = a.to!,
      start = performance.now(),
      duration = reduced ? 1 : (a.duration ?? 300);
    /** Интерполируем один кадр от зафиксированного старта к цели; последний кадр ставит точное значение вместо приблизительной spring-позиции. */
    const tick = (now: number) => {
      if (stopped) return;
      const t = Math.min(1, (now - start) / duration);
      let eased = a.easing?.(t) ?? t;
      if (a.kind === "spring") eased = 1 - Math.exp(-7 * t) * Math.cos(11 * t);
      value.update(t === 1 ? to : from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
  }
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    cancelChild();
  };
}
/** Чистые кривые и их in/out/inOut-композиции преобразуют нормализованное время, не планируя кадры самостоятельно. */
export const Easing = {
  /** Равномерное нормализованное время без ускорения. */
  linear: (t: number) => t,
  /** Smoothstep сглаживает скорость у начала и конца интервала. */
  ease: (t: number) => t * t * (3 - 2 * t),
  /** Кубическая кривая ускорения используется как основа композиций out/inOut. */
  cubic: (t: number) => t * t * t,
  /** Квадратичная кривая даёт более мягкое ускорение, чем cubic. */
  quad: (t: number) => t * t,
  /** Четверть синусоидального цикла преобразует нормализованный прогресс в плавное ускорение. */
  sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  /** Входная композиция сохраняет исходную кривую как заданное ускорение. */
  in: (fn: (t: number) => number) => fn,
  /** Отражаем входную кривую, чтобы получить замедление к концу интервала. */
  out: (fn: (t: number) => number) => (t: number) => 1 - fn(1 - t),
  /** Склеиваем ускорение и отражённое замедление на двух половинах нормализованного времени. */
  inOut: (fn: (t: number) => number) => (t: number) =>
    t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2,
};
/** Создаём descriptor временной анимации; само выполнение начинается при присваивании его shared value. */
export function withTiming(
  to: number,
  options: {
    duration?: number;
    easing?: (t: number) => number;
  } = {},
  callback?: (finished: boolean) => void,
): number {
  return { kind: "timing", to, ...options, callback } as unknown as number;
}
/** Совместимая spring использует фиксированную затухающую кривую в play и заданную длительность; это не отдельный физический solver. */
export function withSpring(
  to: number,
  options: Record<string, number> = {},
  callback?: (finished: boolean) => void,
): number {
  return {
    kind: "spring",
    to,
    duration: options.duration || 650,
    callback,
  } as unknown as number;
}
/** Обертываем дочерний descriptor задержкой, сохраняя общую цепочку отмены в play. */
export function withDelay(delay: number, a: number): number {
  return { kind: "delay", delay, animation: a } as unknown as number;
}
/** Последовательность передаёт управление следующему descriptor только после штатного окончания предыдущего. */
export function withSequence(...items: number[]): number {
  return { kind: "sequence", items } as unknown as number;
}
/** Описываем число повторов и обратную цель; отрицательная единица означает незавершаемую до cancel цепочку. */
export function withRepeat(a: number, count = 2, reverse = false): number {
  return { kind: "repeat", animation: a, count, reverse } as unknown as number;
}
/** Явно останавливаем анимацию данного совместимого Value, не удаляя его подписчиков и последнее значение. */
export function cancelAnimation(value: SharedValue<number>) {
  (value as Value).stopAnimation();
}
/** В браузерном адаптере callbacks уже находятся в JS-потоке; совместимый runOnJS возвращает исходную функцию. */
export const runOnJS = <T extends (...args: never[]) => unknown>(fn: T) => fn;
/** Создаём один Value на экземпляр hook и отменяем его анимацию при unmount; number/boolean overload сохраняют совместимость вызывающего кода. */
export function useSharedValue(value: number): SharedValue<number>;
export function useSharedValue(value: boolean): SharedValue<boolean>;
export function useSharedValue(
  value: number | boolean,
): SharedValue<number | boolean> {
  const ref = useRef<Value | null>(null);
  if (!ref.current) ref.current = new Value(value as unknown as number);
  useEffect(() => () => ref.current?.stopAnimation(), []);
  return ref.current as unknown as SharedValue<number | boolean>;
}
const styles = new WeakMap<object, () => object>();
/** Стабильный marker хранит актуальную функцию в WeakMap, чтобы animated component мог вычислять стиль без React-рендера каждого кадра. */
export function useAnimatedStyle<T extends object>(fn: () => T): T {
  const ref = useRef(fn);
  ref.current = fn;
  const marker = useMemo(() => ({}), []);
  styles.set(marker, () => ref.current());
  return marker as T;
}
/** Из вложенного массива style выбираем только зарегистрированные animated computations для подписки на их Value. */
function computations(style: unknown): Array<() => object> {
  if (Array.isArray(style)) return style.flatMap(computations);
  return style && typeof style === "object" && styles.has(style)
    ? [styles.get(style)!]
    : [];
}
/** Разворачиваем animated markers при первом DOM-рендере, сохраняя остальные объекты и массивы стилей. */
function resolved(style: unknown): unknown {
  if (Array.isArray(style)) return style.map(resolved);
  return style && typeof style === "object" && styles.has(style)
    ? styles.get(style)!()
    : style;
}
/** Переводим вычисленные свойства в CSS, добавляя px размерным числам и отдельно собирая совместимый массив transform. */
function applyMotion(element: HTMLElement, style: Record<string, unknown>) {
  for (const [key, value] of Object.entries(style)) {
    if (key === "transform" && Array.isArray(value)) {
      element.style.transform = value
        .map((transform) =>
          Object.entries(transform)
            .map(
              ([name, v]) =>
                `${name}(${typeof v === "number" && name.startsWith("translate") ? `${v}px` : v})`,
            )
            .join(" "),
        )
        .join(" ");
    } else if (value !== null && value !== undefined) {
      const property = key.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      );
      const unit =
        typeof value === "number" &&
        !["opacity", "zIndex", "flexGrow", "flexShrink", "scale"].includes(key)
          ? "px"
          : "";
      element.style.setProperty(property, String(value) + unit);
    }
  }
}
/** Передаём найденный DOM-узел наружу одинаково для callback-ref и object-ref. */
function assign(ref: Ref<HTMLElement> | undefined, value: HTMLElement | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
/** Описание entrance хранит имя, длительность и задержку; совместимые spring-настройки здесь не создают физическую анимацию. */
class Entrance {
  /** Храним независимые параметры entrance preset; построение описания не запускает DOM-анимацию. */
  constructor(
    public name: string,
    public ms = 300,
    public wait = 0,
  ) {}
  /** Возвращаем новое описание с другой длительностью, не изменяя общий экспортированный preset для остальных компонентов. */
  duration(ms: number) {
    return new Entrance(this.name, ms, this.wait);
  }
  /** Создаём отдельный preset задержки, сохраняя исходные имя и длительность. */
  delay(ms: number) {
    return new Entrance(this.name, this.ms, ms);
  }
  /** Совместимый метод цепочки сохраняет preset; web entrance продолжает использовать Web Animations, отдельного springify-преобразования нет. */
  springify() {
    return this;
  }
  /** Параметр оставлен для совместимости цепочек; браузерная entrance-реализация его не применяет. */
  damping(_v: number) {
    return this;
  }
  /** Совместимый параметр не меняет easing web entrance; возврат this сохраняет существующий builder API. */
  stiffness(_v: number) {
    return this;
  }
}
export const FadeIn = new Entrance("fade");
export const FadeOut = new Entrance("out");
export const FadeInDown = new Entrance("down");
export const FadeInUp = new Entrance("up");
export const SlideInLeft = new Entrance("left");
export const SlideInRight = new Entrance("right");
type MotionOptions = {
  style?: StyleInput;
  className?: string;
  entering?: Entrance;
  exiting?: Entrance;
  onResize?: ComponentPropsWithoutRef<typeof MeasuredBox>["onResize"];
};
type MotionProps<C extends ElementType> = Omit<
  ComponentPropsWithoutRef<C>,
  "style"
> &
  MotionOptions;
/** Оборачиваем DOM/UI-компонент подпиской на Value и entrance-effect; supportsMotionStyles сообщает соседним адаптерам о поддержке marker-стилей. */
function animatedComponent<C extends ElementType>(Component: C) {
  const MotionComponent = forwardRef<HTMLElement, MotionOptions>(
    /** Разделяем подписку на изменяемые стили и одноразовую entrance-анимацию; exiting принят только ради совместимого props-контракта. */
    function Motion({ style, entering, exiting: _, ...props }, ref) {
      const entranceName = entering?.name;
      const entranceDuration = entering?.ms;
      const entranceDelay = entering?.wait;
      const node = useRef<HTMLElement | null>(null);
      const latest = useRef(style);
      latest.current = style;
      useLayoutEffect(() => {
        const values = new Set<Value>();
        collect = values;
        computations(style).forEach((fn) => fn());
        collect = null;
        /** Читаем последнюю функцию стиля через ref, чтобы подписка на Value не применяла устаревшие props предыдущего кадра. */
        const update = () => {
          const element = node.current;
          if (element instanceof HTMLElement)
            computations(latest.current).forEach((fn) =>
              applyMotion(element, fn() as Record<string, unknown>),
            );
        };
        const off = [...values].map((v) => v.subscribe(update));
        update();
        return () => off.forEach((fn) => fn());
      }, [style]);
      useLayoutEffect(() => {
        const element = node.current;
        // SSR and a newly committed screen start hidden, then animate before
        // the first paint. A passive effect would flash the final position.
        element?.removeAttribute("data-motion-enter");
        if (
          !entranceName ||
          !element?.animate ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const transform = (
          {
            down: "translateY(25px)",
            up: "translateY(-25px)",
            left: "translateX(-30px)",
            right: "translateX(30px)",
          } as Record<string, string>
        )[entranceName];
        const entrance = element.animate(
          [
            { opacity: 0, transform: transform || "none" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: entranceDuration,
            delay: entranceDelay,
            easing: ["fade", "down", "up"].includes(entranceName)
              ? "linear"
              : "ease-out",
            fill: "backwards",
          },
        );
        return () => entrance.cancel();
      }, [entranceName, entranceDuration, entranceDelay]);
      const Element = (
        Component === "div" && props.onResize ? MeasuredBox : Component
      ) as ElementType;
      return (
        <Element
          {...props}
          data-motion-enter={entranceName ? "" : undefined}
          className={
            Component === "div"
              ? `ui-stack ${props.className || ""}`
              : props.className
          }
          style={mergeStyles(resolved(style) as StyleInput)}
          ref={(value: HTMLElement | null) => {
            node.current = value;
            assign(ref, value);
          }}
        />
      );
    },
  );
  return Object.assign(MotionComponent, {
    supportsMotionStyles: true,
  }) as unknown as ForwardRefExoticComponent<
    PropsWithoutRef<MotionProps<C>> & RefAttributes<HTMLElement>
  > & { supportsMotionStyles: true };
}
const Animated = {
  div: animatedComponent("div"),
  Typography: animatedComponent(Typography),
  ScrollArea: animatedComponent(ScrollArea),
  Picture: animatedComponent(DomImage),
  createAnimatedComponent: animatedComponent,
};
export default Animated;
/** Стабильный обработчик читает актуальную пользовательскую функцию из ref, поддерживая обе совместимые формы onScroll. */
export function useAnimatedScrollHandler(
  handler:
    | ((event: UIEvent<HTMLDivElement>) => void)
    | {
        onScroll: (event: UIEvent<HTMLDivElement>) => void;
      },
) {
  const ref = useRef(handler);
  ref.current = handler;
  return (event: UIEvent<HTMLDivElement>) => {
    const fn =
      typeof ref.current === "function" ? ref.current : ref.current.onScroll;
    fn(event);
  };
}
/** Собираем Value-зависимости prepare и подписываем react на их изменения; cleanup снимает все подписки текущего набора deps. */
export function useAnimatedReaction<T>(
  prepare: () => T,
  react: (value: T, previous: T | null) => void,
  deps: unknown[] = [],
) {
  const fn = useRef({ prepare, react });
  fn.current = { prepare, react };
  useEffect(() => {
    const values = new Set<Value>();
    collect = values;
    let previous: T | null = fn.current.prepare();
    collect = null;
    const off = [...values].map((v) =>
      v.subscribe(() => {
        const next = fn.current.prepare();
        fn.current.react(next, previous);
        previous = next;
      }),
    );
    return () => off.forEach((f) => f());
    // Dependencies are supplied by callers, like useEffect, while callbacks stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
export enum Extrapolation {
  CLAMP = "clamp",
  EXTEND = "extend",
  IDENTITY = "identity",
}
/** Ищем линейный сегмент input/output; CLAMP ограничивает вход краями, остальные режимы здесь используют линейное продолжение. */
export function interpolate(
  value: number,
  input: number[],
  output: number[],
  mode: Extrapolation | string = Extrapolation.EXTEND,
) {
  if (mode === "clamp")
    value = Math.max(input[0], Math.min(input[input.length - 1], value));
  let i = 0;
  while (i < input.length - 2 && value > input[i + 1]) i++;
  return (
    output[i] +
    ((value - input[i]) / (input[i + 1] - input[i])) *
      (output[i + 1] - output[i])
  );
}
