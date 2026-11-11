"use client";
/** Базовый DOM-адаптер изображений согласует размеры и разрешение локальных ресурсов с остальными UI-компонентами. */
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
  /** Выбираем доступный вариант статического ресурса и передаём пользовательские sizes/srcSet с приоритетом над вычисленными. */
  forwardRef<HTMLImageElement, DomImageProps>(function DomImage(
    { source, style, fit = "cover", alt = "", decoding = "async", ...props },
    ref,
  ) {
    const asset = typeof source === "string" ? { uri: source } : source;
    const resolved = resolveImageAttributes(asset?.uri, false, false, props.sizes);
    return (
      <img
        {...props}
        ref={ref}
        sizes={props.sizes ?? resolved.sizes}
        srcSet={props.srcSet ?? resolved.srcSet}
        src={resolved.src}
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
    /** Измеряем естественные размеры отдельным Image с пределом ожидания 10 секунд; возвращённая функция отменяет загрузку и callbacks. */
    getSize: (
      uri: string,
      success: (width: number, height: number) => void,
      failure?: (error: Event | string) => void,
    ) => {
      const img = new window.Image();
      let finished = false;
      /** Завершаем измерение один раз: снимаем таймер, обработчики и адреса, чтобы поздний ответ не вызвал чужой callback. */
      const cancel = () => {
        finished = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        img.removeAttribute("srcset");
        img.removeAttribute("src");
      };
      const timer = setTimeout(() => {
        if (finished) return;
        cancel();
        failure?.("Image dimensions timed out");
      }, 10_000);
      img.onload = () => {
        if (finished) return;
        const { naturalWidth, naturalHeight } = img;
        cancel();
        success(naturalWidth, naturalHeight);
      };
      img.onerror = (event) => {
        if (finished) return;
        cancel();
        failure?.(event);
      };
      const attributes = resolveImageAttributes(uri);
      img.sizes = attributes.sizes ?? "";
      img.srcset = attributes.srcSet ?? "";
      img.src = attributes.src!;
      return cancel;
    },
    /** Прогреваем браузерную загрузку изображения; Promise отражает onload/onerror, отдельного таймаута у этого пути нет. */
    prefetch: (uri: string) =>
      new Promise<boolean>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(true);
        img.onerror = reject;
        img.src = resolveImageUri(uri)!;
      }),
  },
);
