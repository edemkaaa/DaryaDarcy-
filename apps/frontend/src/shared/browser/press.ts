"use client";
/** Обычный DOM-click объединяет мышь, касание и клавиатуру без отдельного протокола мобильных нажатий. */
/** Возвращаем нативный click handler без второго touch-события, чтобы одно действие не выполнялось дважды. */
export function pressableProps<Args extends unknown[]>(
  onClick: (...args: Args) => void,
) {
  return { onClick };
}
/** Pointerdown сохраняет выделение и не уводит фокус с текста, а сама команда запускается обычным click. */
export function formatToolbarProps(
  onAction: () => void,
  beforeAction?: () => void,
) {
  return {
    onPointerDown: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      beforeAction?.();
    },
    onClick: onAction,
  };
}
