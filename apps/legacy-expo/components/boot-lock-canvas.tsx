import { useEffect, useRef } from "react";
import { Image, Platform, View } from "react-native";

type Props = {
  videoWebmUri?: string;
  videoMp4Uri?: string;
  width: number;
  height: number;
  onReady?: () => void;
  onFailed?: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let VideoView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useVideoPlayer: any = null;
if (Platform.OS !== "web") {
  try {
    const expoVideo = require("expo-video");
    VideoView = expoVideo.VideoView;
    useVideoPlayer = expoVideo.useVideoPlayer;
  } catch {
    // native player unavailable
  }
}

const PLAY_TIMEOUT_MS = 5000;

function NativeBootLockPaperVideo({
  uri,
  width,
  height,
  onReady,
  onFailed,
}: {
  uri: string;
  width: number;
  height: number;
  onReady?: () => void;
  onFailed?: () => void;
}) {
  const readyRef = useRef(false);
  const failedRef = useRef(false);

  const player = useVideoPlayer(uri, (p: { loop: boolean; muted: boolean; play: () => void }) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!readyRef.current && !failedRef.current) {
        failedRef.current = true;
        onFailed?.();
      }
    }, PLAY_TIMEOUT_MS);

    const statusSub = player.addListener("statusChange", ({ status, error }: { status: string; error?: unknown }) => {
      if (status === "readyToPlay" && !readyRef.current) {
        readyRef.current = true;
        onReady?.();
      }
      if (status === "error" && !failedRef.current) {
        failedRef.current = true;
        onFailed?.();
        if (error) {
          console.warn("[boot-lock] video error", error);
        }
      }
    });

    const playingSub = player.addListener("playingChange", ({ isPlaying }: { isPlaying: boolean }) => {
      if (isPlaying && !readyRef.current) {
        readyRef.current = true;
        onReady?.();
      }
    });

    return () => {
      clearTimeout(timeout);
      statusSub.remove();
      playingSub.remove();
    };
  }, [player, onReady, onFailed]);

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <VideoView
        style={{ width, height }}
        player={player}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
      />
    </View>
  );
}

export function BootLockPaperVideo({
  width,
  height,
  videoMp4Uri,
  videoWebmUri,
  onReady,
  onFailed,
}: Props & { videoWebmUri?: string }) {
  const uri = (videoMp4Uri || videoWebmUri || "").trim();

  useEffect(() => {
    if (!uri || !VideoView || !useVideoPlayer) {
      onFailed?.();
    }
  }, [uri, onFailed]);

  if (!uri || !VideoView || !useVideoPlayer) {
    return <BootLockCanvas width={width} height={height} />;
  }

  return (
    <NativeBootLockPaperVideo
      uri={uri}
      width={width}
      height={height}
      onReady={onReady}
      onFailed={onFailed}
    />
  );
}

/** Native chroma canvas is not available — static lock poster as fallback. */
export function BootLockCanvas({ width, height, onFailed }: Props) {
  useEffect(() => {
    onFailed?.();
  }, [onFailed]);

  const aspectRatio = 768 / 1080;
  return (
    <View style={{ width, aspectRatio, maxWidth: width }}>
      <Image
        source={require("@/assets/images/boot-lock-alpha.png")}
        style={{ width: "100%", height: height || width / aspectRatio }}
        resizeMode="contain"
      />
    </View>
  );
}
