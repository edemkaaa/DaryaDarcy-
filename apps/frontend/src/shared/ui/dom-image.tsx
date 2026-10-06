"use client";
import React, { forwardRef, type CSSProperties } from "react";
import { resolveImageUri, resolveImageAttributes } from "./static-images";
export type ImageAsset = {
  uri: string;
  width?: number;
  height?: number;
};
type DomImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "style"
> & {
  source?: ImageAsset | string | null;
  style?: CSSProperties;
  fit?: CSSProperties["objectFit"];
};
export const DomImage = Object.assign(
  forwardRef<HTMLImageElement, DomImageProps>(function DomImage(
    { source, style, fit = "cover", alt = "", decoding = "async", ...props },
    ref,
  ) {
    const asset = typeof source === "string" ? { uri: source } : source;
    const resolved = resolveImageAttributes(asset?.uri);
    return (
      <img
        {...props}
        ref={ref}
        src={resolved.src}
        srcSet={props.srcSet ?? resolved.srcSet}
        sizes={props.sizes ?? resolved.sizes}
        alt={alt}
        width={asset?.width}
        height={asset?.height}
        decoding={decoding}
        draggable={false}
        style={{
          display: "block",
          objectFit: fit,
          ...(asset?.width && asset?.height
            ? { width: asset.width, height: asset.height }
            : {}),
          ...style,
        }}
      />
    );
  }),
  {
    getSize: (
      uri: string,
      success: (width: number, height: number) => void,
      failure?: (error: Event | string) => void,
    ) => {
      const img = new window.Image();
      img.onload = () => success(img.naturalWidth, img.naturalHeight);
      img.onerror = failure || null;
      img.src = resolveImageUri(uri)!;
    },
    prefetch: (uri: string) =>
      new Promise<boolean>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(true);
        img.onerror = reject;
        img.src = resolveImageUri(uri)!;
      }),
  },
);
