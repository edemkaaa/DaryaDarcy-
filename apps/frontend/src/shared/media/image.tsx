"use client";
import classes from "./image.module.scss";
import { mergeStyles } from "@/shared/ui/css";
import { type BoxProps, DomImage } from "@/shared/ui/elements";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
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
  fadeOnLoad?: boolean;
  retryKey?: number;
  showRetryButton?: boolean;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  /** Called after automatic recovery attempts have failed. */
  onError?: (event: unknown) => void;
  onLoad?: (event: {
    source: {
      width: number;
      height: number;
      url: string;
    };
  }) => void;
};
const RETRY_DELAYS = [2_000, 5_000];

export function ImageFailure({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={classes.fallback}>
      <span role="img" aria-label="Изображение недоступно">
        Не удалось загрузить изображение
      </span>
      {onRetry ? (
        <button
          type="button"
          className={classes.retry}
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
        >
          Повторить загрузку
        </button>
      ) : null}
    </div>
  );
}

const PictureContent = forwardRef<HTMLDivElement, ImageProps>(
  function PictureContent(
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
      fadeOnLoad = false,
      retryKey: _retryKey,
      showRetryButton = false,
      loadingFallback,
      errorFallback,
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
    const [loaded, setLoaded] = useState(false);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [useOriginal, setUseOriginal] = useState(false);
    const resolved = resolveImageAttributes(
      asset?.uri,
      fullSize || useOriginal,
      optimizeLocal,
      sizes,
    );
    const terminalFailure = failed && attempt >= RETRY_DELAYS.length;
    const hasCustomLoader = loadingFallback !== undefined;
    const retry = () => {
      setLoaded(false);
      setFailed(false);
      setAttempt((value) => value + 1);
    };
    useEffect(() => {
      if (
        !hasCustomLoader ||
        !asset?.uri ||
        loaded ||
        failed
      )
        return;
      const image = imageRef.current;
      if (!image) return;
      // Also detect completion if a cached image's load event was missed.
      // Intrinsic dimensions alone do not mean a progressive photo is finished.
      const isComplete = () => image.complete && image.naturalWidth > 0;
      if (isComplete()) {
        setLoaded(true);
        return;
      }
      const timer = window.setInterval(() => {
        if (!isComplete()) return;
        setLoaded(true);
        window.clearInterval(timer);
      }, 100);
      return () => window.clearInterval(timer);
    }, [
      hasCustomLoader,
      asset?.uri,
      loaded,
      failed,
      attempt,
      useOriginal,
    ]);
    useEffect(() => {
      if (!failed) return;
      // Retry only failed requests. A slow request remains in flight indefinitely.
      const resume = () => {
        if (!navigator.onLine) return;
        setLoaded(false);
        setFailed(false);
        setAttempt((value) => value + 1);
      };
      window.addEventListener("online", resume);
      const delay = RETRY_DELAYS[attempt];
      const timer =
        navigator.onLine && delay !== undefined
          ? window.setTimeout(resume, delay)
          : undefined;
      return () => {
        window.removeEventListener("online", resume);
        window.clearTimeout(timer);
      };
    }, [failed, attempt]);
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
          key={`${attempt}-${useOriginal}`}
          ref={(image) => {
            imageRef.current = image;
            // Cached images may finish before the load handler is attached.
            if (image?.complete && image.naturalWidth > 0) {
              setLoaded(true);
            }
          }}
          src={resolved.src}
          alt={label || ""}
          width={asset?.width}
          height={asset?.height}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          srcSet={useOriginal ? undefined : (srcSet ?? resolved.srcSet)}
          sizes={sizes ?? resolved.sizes}
          draggable={false}
          onError={(event) => {
            // The frontend optimizer has its own upstream timeout. Bypass it
            // after a failure so the browser can wait for the original photo.
            if (!useOriginal && resolved.src?.startsWith("/_next/image?")) {
              setLoaded(false);
              setUseOriginal(true);
              return;
            }
            setFailed(true);
            if (attempt >= RETRY_DELAYS.length) onError?.(event);
          }}
          onLoad={(event) => {
            setFailed(false);
            setLoaded(true);
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
            opacity: fadeOnLoad && !loaded ? 0 : undefined,
            objectFit: contentFit,
            objectPosition: contentPosition,
            transition: transition ? `opacity ${transition}ms` : undefined,
          }}
          className={classes.img}
        />
        {terminalFailure ? (
          errorFallback !== undefined ? (
            errorFallback
          ) : (
            <ImageFailure onRetry={showRetryButton ? retry : undefined} />
          )
        ) : asset?.uri &&
          !loaded &&
          (fadeOnLoad ||
            showRetryButton ||
            failed ||
            attempt > 0 ||
            useOriginal) ? (
          loadingFallback !== undefined ? (
            loadingFallback
          ) : (
            <span role="status" className={classes.loading}>
              {failed ? "Повторяем загрузку…" : "Загрузка изображения…"}
            </span>
          )
        ) : null}
      </div>
    );
  },
);

export const Picture = Object.assign(
  forwardRef<HTMLDivElement, ImageProps>(function Picture(props, ref) {
    const uri =
      typeof props.source === "string" ? props.source : props.source?.uri;
    // Source changes and manual retries start a fresh lifecycle, including timers.
    return (
      <PictureContent
        key={JSON.stringify([
          uri,
          props.srcSet,
          props.sizes,
          props.fullSize,
          props.optimizeLocal,
          props.retryKey,
        ])}
        {...props}
        ref={ref}
      />
    );
  }),
  { getSize: DomImage.getSize, prefetch: DomImage.prefetch },
);
