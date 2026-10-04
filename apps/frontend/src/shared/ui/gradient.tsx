"use client";
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps } from "@/shared/ui/elements";
export function LinearGradient({
  colors,
  locations,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
  style,
  className = "",
  ...props
}: BoxProps & {
  colors: readonly string[];
  locations?: readonly number[];
  start?: {
    x: number;
    y: number;
  };
  end?: {
    x: number;
    y: number;
  };
}) {
  const angle = (Math.atan2(end.x - start.x, end.y - start.y) * 180) / Math.PI;
  return (
    <div
      {...props}
      style={mergeStyles(
        {
          backgroundImage: `linear-gradient(${180 - angle}deg, ${colors.map((c, i) => c + (locations?.[i] !== undefined ? ` ${locations[i] * 100}%` : "")).join(", ")})`,
        },
        style,
      )}
      className={`ui-stack ${className}`}
    />
  );
}
