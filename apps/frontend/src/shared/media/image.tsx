"use client";
/** Картинка имеет ограниченный цикл загрузки и повторов; таймер для lazy-фото начинается после появления в видимой области. */
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
import {
  rememberImageDisplay,
  wasImageDisplayed,
} from "./image-display-history";
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
const VISIBLE_LOAD_TIMEOUT = 30_000;

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
      decoding,
      fetchPriority = "auto",
      srcSet,
      sizes,
      fullSize = false,
      optimizeLocal = false,
      contentFit = "cover",
      contentPosition = "center",
      transition = 0,
      fadeOnLoad = false,
      retryKey,
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
    const [timedOut, setTimedOut] = useState(false);
    const onErrorRef = useRef(onError);
    useEffect(() => {
      onErrorRef.current = onError;
    }, [onError]);
    const [attempt, setAttempt] = useState(0);
    const [useOriginal, setUseOriginal] = useState(false);
    const resolved = resolveImageAttributes(
      asset?.uri,
      fullSize || useOriginal,
      optimizeLocal,
      sizes,
    );
    const displayKey = JSON.stringify([
      resolved.src,
      srcSet ?? resolved.srcSet,
      sizes ?? resolved.sizes,
      retryKey,
    ]);
    // Память о показе убирает повторный fade; она не свидетельствует о свежести байтов в HTTP-кеше.
    const [displayedBefore] = useState(() => wasImageDisplayed(displayKey));
    const revealOnLoad = fadeOnLoad && !displayedBefore;
    // Явная ошибка допускает ограниченные повторы, а зависший запрос требует ручного решения пользователя.
    const terminalFailure =
      timedOut || (failed && attempt >= RETRY_DELAYS.length);
    const retry = () => {
      setLoaded(false);
      setFailed(false);
      setTimedOut(false);
      setAttempt((value) => value + 1);
    };
    useEffect(() => {
      if (!asset?.uri || loaded || failed || timedOut) return;
      const image = imageRef.current;
      if (!image) return;
      let timer: number | undefined;
      const start = () => {
        if (timer !== undefined) return;
        if (image.complete && image.naturalWidth > 0) {
          setLoaded(true);
          return;
        }
        timer = window.setTimeout(() => {
          if (image.complete && image.naturalWidth > 0) {
            setLoaded(true);
            return;
          }
          // Clear sources immediately, then keep the expired element mounted
          // so a retry cannot join the old, still pending browser request.
          image.removeAttribute("srcset");
          image.removeAttribute("src");
          // Do not automatically restart a hung request and waste bandwidth.
          setTimedOut(true);
          onErrorRef.current?.(new Error("Image loading timed out"));
        }, VISIBLE_LOAD_TIMEOUT);
      };
      // Native lazy loading can defer an offscreen image indefinitely.
      // Its timeout starts only when the user can actually see it.
      const observer = new IntersectionObserver(
        (entries) => {
          // An adjacent carousel slide can intersect only at an edge (area 0).
          if (!entries.some((entry) => entry.intersectionRatio >= 0.01)) return;
          start();
          observer.disconnect();
        },
        { threshold: 0.01 },
      );
      if (loading === "eager") start();
      else observer.observe(image);
      return () => {
        observer.disconnect();
        window.clearTimeout(timer);
      };
    }, [asset?.uri, loaded, failed, timedOut, attempt, useOriginal, loading]);
    useEffect(() => {
      if (!failed) return;
      // Retry explicit failures only; a timeout requires a manual retry.
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
            if (!timedOut && image?.complete && image.naturalWidth > 0) {
              rememberImageDisplay(displayKey);
              setLoaded(true);
            }
          }}
          alt={label || ""}
          width={asset?.width}
          height={asset?.height}
          loading={loading}
          decoding={decoding ?? (displayedBefore ? "sync" : "async")}
          fetchPriority={fetchPriority}
          // Safari can start the fallback before seeing its responsive sizes.
          sizes={sizes ?? resolved.sizes}
          srcSet={
            timedOut || useOriginal ? undefined : (srcSet ?? resolved.srcSet)
          }
          src={timedOut ? undefined : resolved.src}
          draggable={false}
          onError={(event) => {
            if (timedOut || imageRef.current !== event.currentTarget) return;
            // Recover a temporary preview failure before fetching a much
            // larger original. Preserve its URL/signature across retries.
            if (
              !useOriginal &&
              resolved.src?.startsWith("/_next/image?") &&
              attempt >= RETRY_DELAYS.length
            ) {
              setLoaded(false);
              setUseOriginal(true);
              return;
            }
            setFailed(true);
            if (attempt >= RETRY_DELAYS.length) onError?.(event);
          }}
          onLoad={(event) => {
            if (timedOut || imageRef.current !== event.currentTarget) return;
            setFailed(false);
            setLoaded(true);
            rememberImageDisplay(displayKey);
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
            visibility: failed || timedOut ? "hidden" : undefined,
            opacity: revealOnLoad && !loaded ? 0 : undefined,
            objectFit: contentFit,
            objectPosition: contentPosition,
            transition:
              transition && !displayedBefore
                ? `opacity ${transition}ms`
                : undefined,
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
          (revealOnLoad ||
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
