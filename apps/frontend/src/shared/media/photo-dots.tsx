import type { CSSProperties } from "react";
import classes from "./photo-dots.module.scss";

export function PhotoDots({
  count,
  index,
  className = "",
  style,
}: {
  count: number;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  // Keep Expo's compact indicators; longer galleries retain the numeric counter.
  if (count <= 1 || count > 10) return null;
  return (
    <div
      role="img"
      aria-label={`Фото ${index + 1} из ${count}`}
      className={`${classes.dots} ${className}`}
      style={style}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-current={i === index ? "true" : undefined}
          className={i === index ? classes.active : classes.dot}
        />
      ))}
    </div>
  );
}
