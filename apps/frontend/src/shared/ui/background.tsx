"use client";
import { mergeStyles } from "@/shared/ui/css";
import { forwardRef, type CSSProperties } from "react";
import type { BoxProps } from "./types";
import { DomImage, type ImageAsset } from "./dom-image";
type BackgroundProps = BoxProps & {
  source?: ImageAsset | string | null;
  imageStyle?: CSSProperties;
  imageClassName?: string;
  fit?: CSSProperties["objectFit"];
};
export const Background = forwardRef<HTMLDivElement, BackgroundProps>(
  function Background(
    {
      source,
      imageStyle,
      imageClassName,
      fit = "cover",
      style,
      className = "",
      children,
      ...props
    },
    ref,
  ) {
    return (
      <div
        {...props}
        ref={ref}
        className={`ui-stack ${className}`}
        style={mergeStyles(style)}
      >
        <DomImage
          source={source}
          fit={fit}
          className={imageClassName}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
            ...imageStyle,
          }}
        />
        {children}
      </div>
    );
  },
);
