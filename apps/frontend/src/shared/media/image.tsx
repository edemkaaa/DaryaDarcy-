"use client";
import classes from "./image.module.scss";
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps, DomImage } from "@/shared/ui/elements";
import { forwardRef, useState, type ImgHTMLAttributes } from "react";
import { resolveImageAttributes } from "@/shared/ui/static-images";
export type ImageSource = {
  uri: string;
  width?: number;
  height?: number;
};
export type ImageProps = Omit<BoxProps, "onLoad" | "onError"> & {
  source?: ImageSource | string | null;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  decoding?: ImgHTMLAttributes<HTMLImageElement>["decoding"];
  fetchPriority?: ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
  srcSet?: string;
  sizes?: string;
  fullSize?: boolean;
  optimizeLocal?: boolean;
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
      loading = "lazy",
      decoding = "async",
      fetchPriority = "auto",
      srcSet,
      sizes,
      fullSize = false,
      optimizeLocal = false,
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
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const resolved = resolveImageAttributes(asset?.uri, fullSize, optimizeLocal, sizes);
    const sourceKey = JSON.stringify([asset?.uri, srcSet ?? resolved.srcSet, fullSize, optimizeLocal]);
    const failed = failedSource === sourceKey;
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
          src={resolved.src}
          alt={label || ""}
          width={asset?.width}
          height={asset?.height}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          srcSet={srcSet ?? resolved.srcSet}
          sizes={sizes ?? resolved.sizes}
          draggable={false}
          onError={(event) => {
            setFailedSource(sourceKey);
            onError?.(event);
          }}
          onLoad={(event) => {
            setFailedSource(null);
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
            visibility: failed ? "hidden" : undefined,
            objectFit: contentFit,
            objectPosition: contentPosition,
            transition: transition ? `opacity ${transition}ms` : undefined,
          }}
          className={classes.img}
        />
        {failed ? (
          <span
            role="img"
            aria-label="Изображение недоступно"
            className={classes.fallback}
          >
            Изображение недоступно
          </span>
        ) : null}
      </div>
    );
  }),
  { getSize: DomImage.getSize, prefetch: DomImage.prefetch },
);
