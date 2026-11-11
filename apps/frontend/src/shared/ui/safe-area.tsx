"use client";
/** Отступы безопасной области применяем по выбранным сторонам, чтобы содержимое не перекрывалось элементами устройства. */
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps } from "@/shared/ui/elements";
export type Edge = "top" | "right" | "bottom" | "left";
export { useBrowserSafeAreaInsets as useSafeAreaInsets } from "@/shared/browser/viewport";
/** Добавляем безопасные отступы только на выбранных сторонах; верх и низ допускают значения контейнера Mini App. */
export function SafeArea({
  edges = ["top", "left", "right"],
  style,
  className = "",
  ...props
}: BoxProps & {
  edges?: Edge[];
}) {
  return (
    <div
      {...props}
      style={mergeStyles(
        {
          paddingTop: edges.includes("top")
            ? "var(--screen-safe-top, env(safe-area-inset-top, 0px))"
            : 0,
          paddingRight: edges.includes("right")
            ? "env(safe-area-inset-right, 0px)"
            : 0,
          paddingBottom: edges.includes("bottom")
            ? "var(--screen-safe-bottom, env(safe-area-inset-bottom, 0px))"
            : 0,
          paddingLeft: edges.includes("left")
            ? "env(safe-area-inset-left, 0px)"
            : 0,
        },
        style,
      )}
      className={`ui-stack ${className}`}
    />
  );
}
