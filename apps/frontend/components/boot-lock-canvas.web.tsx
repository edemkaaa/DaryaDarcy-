import { useEffect, useRef, type RefObject } from "react";
import { createElement } from "react";
import { isAppleMobileWeb } from "@/lib/device";

type Props = {
  videoWebmUri?: string;
  videoMp4Uri?: string;
  width: number;
  height: number;
  onReady?: () => void;
  onFailed?: () => void;
};

/** Only remove near-pure black background; keep dark lock/key metal. */
const KEY_MAX = 18;
const KEY_SOFT = 14;

const SOURCE_WIDTH = 768;
const SOURCE_HEIGHT = 1080;
const PLAY_TIMEOUT_MS = 5000;
const READY_MIN_TIME = 0.04;

/** Safari/iOS won't advance frames when video is display:none — keep it painted but invisible. */
const HIDDEN_VIDEO_STYLE: Record<string, string | number> = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  pointerEvents: "none",
};

function keyOutFrame(ctx: CanvasRenderingContext2D, bufferW: number, bufferH: number) {
  const imageData = ctx.getImageData(0, 0, bufferW, bufferH);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < KEY_MAX) {
      data[i + 3] = 0;
    } else if (max < KEY_MAX + KEY_SOFT && max - min < 10) {
      data[i + 3] = Math.round(((max - KEY_MAX) / KEY_SOFT) * 255);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function renderScale(displayW: number, displayH: number) {
  if (typeof window === "undefined") {
    return { bufferW: displayW, bufferH: displayH };
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return {
    bufferW: Math.min(Math.round(displayW * dpr), SOURCE_WIDTH),
    bufferH: Math.min(Math.round(displayH * dpr), SOURCE_HEIGHT),
  };
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  bufferW: number,
  bufferH: number,
) {
  ctx.clearRect(0, 0, bufferW, bufferH);
  ctx.save();
  ctx.translate(bufferW, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, bufferW, bufferH);
  ctx.restore();
  try {
    keyOutFrame(ctx, bufferW, bufferH);
  } catch {
    // If canvas read fails, keep the raw frame.
  }
}

function useBootVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  onReady?: () => void,
  onFailed?: () => void,
) {
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onFailedRef = useRef(onFailed);

  onReadyRef.current = onReady;
  onFailedRef.current = onFailed;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let playTimeout = 0;
    let playAttempts = 0;

    const markReady = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      onReadyRef.current?.();
    };

    const tryPlay = () => {
      if (video.ended) return;
      playAttempts += 1;
      void video.play().catch(() => {
        if (playAttempts < 12) {
          window.setTimeout(tryPlay, 80);
        }
      });
    };

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      video.loop = false;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.currentTime = 0;
      tryPlay();
      playTimeout = window.setTimeout(() => {
        if (!readyRef.current && video.currentTime < READY_MIN_TIME) {
          onFailedRef.current?.();
        }
      }, PLAY_TIMEOUT_MS);
    };

    const onTimeUpdate = () => {
      if (video.currentTime >= READY_MIN_TIME) markReady();
    };
    const onError = () => onFailedRef.current?.();

    video.addEventListener("loadeddata", start);
    video.addEventListener("canplay", start);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("playing", onTimeUpdate);
    video.addEventListener("error", onError);
    if (video.readyState >= 2) start();

    return () => {
      window.clearTimeout(playTimeout);
      video.removeEventListener("loadeddata", start);
      video.removeEventListener("canplay", start);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("playing", onTimeUpdate);
      video.removeEventListener("error", onError);
      video.pause();
    };
  }, [videoRef]);
}

function scheduleFrame(video: HTMLVideoElement, draw: () => void): () => void {
  const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number })
    .requestVideoFrameCallback;
  if (rvfc) {
    let active = true;
    const tick = () => {
      if (!active) return;
      draw();
      rvfc.call(video, tick);
    };
    rvfc.call(video, tick);
    return () => {
      active = false;
    };
  }

  let raf = 0;
  const loop = () => {
    draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

function BootLockCanvasDraw({
  videoWebmUri,
  videoMp4Uri,
  width,
  height,
  onReady,
  onFailed,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useBootVideoPlayback(videoRef, onReady, onFailed);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      onFailed?.();
      return;
    }

    const { bufferW, bufferH } = renderScale(width, height);
    canvas.width = bufferW;
    canvas.height = bufferH;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    let stopped = false;
    let playAttempts = 0;
    let cancelFrame = () => {};

    const tryPlay = () => {
      if (stopped || video.ended) return;
      playAttempts += 1;
      void video.play().catch(() => {
        if (playAttempts < 12) window.setTimeout(tryPlay, 80);
      });
    };

    const draw = () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        if (video.paused && !video.ended) tryPlay();
        paintFrame(ctx, video, bufferW, bufferH);
      }
    };

    cancelFrame = scheduleFrame(video, draw);

    return () => {
      stopped = true;
      cancelFrame();
      video.pause();
    };
  }, [videoWebmUri, videoMp4Uri, width, height, onFailed]);

  const apple = isAppleMobileWeb();
  const sources = [
    videoWebmUri
      ? createElement("source", { key: "webm", src: videoWebmUri, type: "video/webm" })
      : null,
    videoMp4Uri
      ? createElement("source", { key: "mp4", src: videoMp4Uri, type: "video/mp4" })
      : null,
  ].filter(Boolean);

  const videoEl =
    apple && videoMp4Uri
      ? createElement("video", {
          ref: videoRef,
          src: videoMp4Uri,
          muted: true,
          playsInline: true,
          preload: "auto",
          style: HIDDEN_VIDEO_STYLE,
        })
      : createElement(
          "video",
          {
            ref: videoRef,
            muted: true,
            playsInline: true,
            preload: "auto",
            style: HIDDEN_VIDEO_STYLE,
          },
          ...sources,
        );

  return createElement(
    "div",
    { style: { width, height, position: "relative", overflow: "hidden", background: "transparent" } },
    videoEl,
    createElement("canvas", {
      ref: canvasRef,
      width,
      height,
      style: {
        position: "relative",
        zIndex: 1,
        width: "100%",
        height: "100%",
        display: "block",
        background: "transparent",
      },
    }),
  );
}

/** Paper + lock baked into video — full-screen cover, no chroma key or visible frame. */
export function BootLockPaperVideo({
  videoMp4Uri,
  videoWebmUri,
  width,
  height,
  fullScreen = false,
  onReady,
  onFailed,
}: {
  videoMp4Uri?: string;
  videoWebmUri?: string;
  width?: number;
  height?: number;
  fullScreen?: boolean;
  onReady?: () => void;
  onFailed?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useBootVideoPlayback(videoRef, onReady, onFailed);

  const style: Record<string, string | number> = fullScreen
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "contain",
        objectPosition: "center center",
        background: "transparent",
      }
    : {
        width: width ?? "100%",
        height: height ?? "100%",
        display: "block",
        objectFit: "contain",
        background: "transparent",
      };

  const apple = isAppleMobileWeb();
  const sources = [
    videoWebmUri
      ? createElement("source", { key: "webm", src: videoWebmUri, type: "video/webm" })
      : null,
    videoMp4Uri
      ? createElement("source", { key: "mp4", src: videoMp4Uri, type: "video/mp4" })
      : null,
  ].filter(Boolean);

  if (apple && videoMp4Uri) {
    return createElement("video", {
      ref: videoRef,
      src: videoMp4Uri,
      muted: true,
      playsInline: true,
      preload: "auto",
      ...(fullScreen ? {} : { width, height }),
      style,
    });
  }

  if (sources.length === 0) return null;

  return createElement(
    "video",
    {
      ref: videoRef,
      muted: true,
      playsInline: true,
      preload: "auto",
      ...(fullScreen ? {} : { width, height }),
      style,
    },
    ...sources,
  );
}

/** Lock animation — canvas chroma key; iOS uses BootLockPaperVideo instead. */
export function BootLockCanvas(props: Props) {
  return createElement(BootLockCanvasDraw, props);
}
