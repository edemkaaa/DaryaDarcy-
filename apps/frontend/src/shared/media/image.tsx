"use client";
import classes from "./image.module.scss";
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps, DomImage } from "@/shared/ui/elements";
import { forwardRef } from "react";
export type ImageSource = {
  uri: string;
  width?: number;
  height?: number;
};
export type ImageProps = Omit<BoxProps, "onLoad" | "onError"> & {
  source?: ImageSource | string | null;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  contentPosition?: string;
  transition?: number;
  onError?: (event: unknown) => void;
  onLoad?: (event: {
    source: {
      width: number;
      height: number;
      url: string;
    };
  }) => void;
};
export const Picture = Object.assign(
  forwardRef<HTMLDivElement, ImageProps>(function Picture(
    {
      source,
      contentFit = "cover",
      contentPosition = "center",
      transition = 0,
      onLoad,
      onError,
      style,
      "aria-label": label,
      className = "",
      ...props
    },
    ref,
  ) {
    const asset =
      typeof source === "string"
        ? { uri: source }
        : typeof source === "object"
          ? source
          : null;
    return (
      <div
        ref={ref}
        {...props}
        style={mergeStyles(
          {
            ...((asset?.width && asset?.height ? true : false)
              ? {
                  width:
                    asset?.width && asset?.height ? asset.width : undefined,
                }
              : {}),
            ...((asset?.width && asset?.height ? true : false)
              ? {
                  height:
                    asset?.width && asset?.height ? asset.height : undefined,
                }
              : {}),
          },
          style,
        )}
        className={[`ui-stack ${className}`, classes.div]
          .filter(Boolean)
          .join(" ")}
      >
        <img
          src={asset?.uri}
          alt={label || ""}
          draggable={false}
          onError={onError}
          onLoad={(event) => {
            const image = event.currentTarget;
            onLoad?.({
              source: {
                width: image.naturalWidth,
                height: image.naturalHeight,
                url: image.currentSrc,
              },
            });
          }}
          style={{
            objectFit: contentFit,
            objectPosition: contentPosition,
            transition: transition ? `opacity ${transition}ms` : undefined,
          }}
          className={classes.img}
        />
      </div>
    );
  }),
  { getSize: DomImage.getSize, prefetch: DomImage.prefetch },
);
