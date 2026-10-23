"use client";
import classes from "./screen-container.module.scss";
import type { CSSProperties } from "react";
import { Background, type BoxProps } from "./elements";
import { SafeArea, type Edge } from "./safe-area";
import { ScrollArea } from "./scroll-area";
import { useColors } from "@/shared/styles/use-colors";
const paper =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export interface ScreenContainerProps extends BoxProps {
  edges?: Edge[];
  showTexture?: boolean;
  backgroundColor?: CSSProperties["backgroundColor"];
  scrollable?: boolean;
}
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  showTexture = true,
  backgroundColor,
  scrollable = false,
  style,
  className = "",
  ...props
}: ScreenContainerProps) {
  const colors = useColors();
  const content = (
    <SafeArea edges={edges} className={classes.div} style={style}>
      <div className={["ui-stack", classes.div].filter(Boolean).join(" ")}>
        {scrollable ? (
          <ScrollArea hideScrollbar>{children}</ScrollArea>
        ) : (
          children
        )}
      </div>
    </SafeArea>
  );
  return showTexture ? (
    <Background
      {...props}
      className={[className, classes.div].filter(Boolean).join(" ")}
      source={{ uri: paper }}
      fit="cover"
      style={{ backgroundColor: backgroundColor || "#F5EDE3" }}
    >
      {content}
    </Background>
  ) : (
    <div
      {...props}
      className={[`ui-stack ${className}`, classes.div]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: backgroundColor || colors.background }}
    >
      {content}
    </div>
  );
}
