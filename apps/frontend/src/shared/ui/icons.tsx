"use client";
import classes from "./icons.module.scss";
import { type StyleInput, px, mergeStyles } from "@/shared/ui/css";
import { Typography } from "@/shared/ui/elements";
import material from "./glyphs/MaterialIcons.json";
type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleInput;
  [key: string]: unknown;
};
function family(font: string, glyphs: Record<string, number>) {
  return function Icon({ name, size = 24, color, style, ...props }: Props) {
    return (
      <Typography
        {...props}
        aria-hidden
        style={mergeStyles(
          {
            fontFamily: font,
            fontSize: size,
            color: color,
            lineHeight: px(size),
          },
          style,
        )}
        className={classes.typography}
      >
        {glyphs[name] ? String.fromCodePoint(glyphs[name]) : ""}
      </Typography>
    );
  };
}
export const MaterialIcons = Object.assign(family("MaterialIcons", material), {
  glyphMap: material,
});
