"use client";
/** Standard DOM click handling works on desktop, touch browsers and keyboard. */
export function pressableProps<Args extends unknown[]>(
  onClick: (...args: Args) => void,
) {
  return { onClick };
}
/** Keep the editor selection before a toolbar action steals focus. */
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
