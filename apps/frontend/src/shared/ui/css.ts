import type { CSSProperties } from "react";
export type { CSSProperties } from "react";
export type StyleInput =
  | CSSProperties
  | false
  | null
  | undefined
  | readonly StyleInput[];
export function mergeStyles(...inputs: StyleInput[]): CSSProperties {
  const result: CSSProperties = {};
  for (const input of inputs) {
    if (Array.isArray(input)) Object.assign(result, mergeStyles(...input));
    else if (input) Object.assign(result, input);
  }
  return result;
}
export const px = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;
export function cssTransform(
  transforms: readonly Record<string, string | number>[],
): string {
  return transforms
    .flatMap((t) =>
      Object.entries(t).map(
        ([name, value]) =>
          `${name}(${typeof value === "number" && (name.startsWith("translate") || name === "perspective") ? `${value}px` : value})`,
      ),
    )
    .join(" ");
}
