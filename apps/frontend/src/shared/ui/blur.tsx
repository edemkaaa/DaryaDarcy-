"use client";
/** Параметры размытия преобразуем в CSS-оформление слоя; доступ к содержимому этим эффектом не ограничивается. */
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps } from "@/shared/ui/elements";
export function BlurView({
  intensity = 50,
  tint = "light",
  style,
  className = "",
  ...props
}: BoxProps & {
  intensity?: number;
  tint?: string;
}) {
  return (
    <div
      {...props}
      style={mergeStyles(
        {
          backdropFilter: `blur(${intensity / 5}px)`,
          backgroundColor:
            tint === "dark" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.15)",
        },
        style,
      )}
      className={`ui-stack ${className}`}
    />
  );
}
