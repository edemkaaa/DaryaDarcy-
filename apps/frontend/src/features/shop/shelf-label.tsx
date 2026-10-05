"use client";
import { useViewport } from "@/shared/browser/viewport";

import type { CSSProperties } from "react";
import classes from "./shelf-label.module.scss";
import { mergeStyles } from "@/shared/ui/css";
import { Typography } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { ASSETS } from "./shop-screen.content";
import { getShopScreenContent } from "./shop-screen.content";
export function ShelfLabel({
  text,
  style,
}: {
  text: string;
  style?: CSSProperties;
}) {
  const viewport = useViewport();
  const { LABEL_WIDTH, LABEL_HEIGHT } = getShopScreenContent(viewport);

  return (
    <div
      style={mergeStyles({ width: LABEL_WIDTH, height: LABEL_HEIGHT }, style)}
      className={["ui-stack ", classes.label].filter(Boolean).join(" ")}
    >
      <Picture
        source={{ uri: ASSETS.labelFrame }}
        contentFit="fill"
        className={classes.frame}
      />
      <Typography lines={1} className={classes.text}>
        {text}
      </Typography>
    </div>
  );
}
