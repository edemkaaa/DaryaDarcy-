import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { BootLockCanvas, BootLockPaperVideo } from "@/components/boot-lock-canvas";

type Props = {
  fontsLoaded: boolean;
  fontError: Error | null;
  children: ReactNode;
};

/** Full 2s key turn, then fade — no loop. */
export const WEB_BOOT_MS = 2200;
export const MAX_BOOT_MS = 7000;
export const BOOT_FADE_MS = 500;
export const BOOT_CREAM = "#FDF8F0";
export const BOOT_PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

const bootVideoPaperMp4Module = require("@/assets/videos/app-boot-paper.mp4");
const bootVideoPaperWebmModule = require("@/assets/videos/app-boot-paper.webm");
const bootVideoWebmModule = require("@/assets/videos/app-boot.webm");
const bootVideoMp4Module = require("@/assets/videos/app-boot.mp4");
const bootLockImage = require("@/assets/images/boot-lock-alpha.png");

const LOCK_WIDTH = 79;
const LOCK_SCREEN_FRACTION = 0.19;
/** Paper video frame — ~2× lock box so the lock reads at LOCK_WIDTH without cropping. */
const PAPER_VIDEO_WIDTH = 158;
const PAPER_SCREEN_FRACTION = 0.38;
const LOCK_ASPECT = 768 / 1080;

type BootPhase = "playing" | "fading" | "hidden";
type BootAnimMode = "paper" | "chroma" | "static";

type AssetModule = string | number | { uri?: string; default?: string | { uri?: string } };

function resolveAssetUri(mod: AssetModule): string {
  if (typeof mod === "string" && mod) return mod;
  if (typeof mod === "number") {
    const { resolveAssetSource } = require("react-native/Libraries/Image/resolveAssetSource");
    const uri = resolveAssetSource(mod)?.uri ?? "";
    if (uri) return uri;
  }
  if (mod && typeof mod === "object") {
    if (typeof mod.uri === "string" && mod.uri) return mod.uri;
    if (typeof mod.default === "string" && mod.default) return mod.default;
    if (mod.default && typeof mod.default === "object" && typeof mod.default.uri === "string") {
      return mod.default.uri;
    }
  }
  return "";
}

const bootVideoPaperMp4Uri = resolveAssetUri(bootVideoPaperMp4Module as AssetModule);
const bootVideoPaperWebmUri = resolveAssetUri(bootVideoPaperWebmModule as AssetModule);
const bootVideoWebmUri = resolveAssetUri(bootVideoWebmModule as AssetModule);
const bootVideoMp4Uri = resolveAssetUri(bootVideoMp4Module as AssetModule);

function initialAnimMode(): BootAnimMode {
  if (bootVideoPaperMp4Uri || bootVideoPaperWebmUri) return "paper";
  if (bootVideoWebmUri || bootVideoMp4Uri) return "chroma";
  return "static";
}

function BootLockImage({ width, height }: { width: number; height: number }) {
  return (
    <ExpoImage
      source={bootLockImage}
      style={{ width, height }}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

function BootLockPoster() {
  const { width: screenW } = useWindowDimensions();
  const lockW = Math.min(LOCK_WIDTH, Math.round(screenW * LOCK_SCREEN_FRACTION));
  const lockH = Math.round(lockW / LOCK_ASPECT);

  return (
    <>
      <ImageBackground
        source={{ uri: BOOT_PAPER_TEXTURE_URI }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.center} pointerEvents="none">
        <BootLockImage width={lockW} height={lockH} />
      </View>
    </>
  );
}

function BootScreen({
  message,
  showRetry,
  fading,
}: {
  message?: string;
  showRetry?: boolean;
  fading?: boolean;
}) {
  const { width: screenW } = useWindowDimensions();
  const lockW = Math.min(LOCK_WIDTH, Math.round(screenW * LOCK_SCREEN_FRACTION));
  const lockH = Math.round(lockW / LOCK_ASPECT);
  const paperW = Math.min(PAPER_VIDEO_WIDTH, Math.round(screenW * PAPER_SCREEN_FRACTION));
  const paperH = Math.round(paperW / LOCK_ASPECT);

  const [mode, setMode] = useState<BootAnimMode>(initialAnimMode);
  const [animReady, setAnimReady] = useState(false);

  const onPaperFail = useCallback(() => {
    setAnimReady(false);
    if (bootVideoWebmUri || bootVideoMp4Uri) {
      setMode("chroma");
      return;
    }
    setMode("static");
  }, []);

  const onChromaFail = useCallback(() => {
    setAnimReady(false);
    setMode("static");
  }, []);

  const showPosterUnderlay = mode === "static";

  const bootId =
    Platform.OS === "web" ? ({ id: "dd-boot-overlay" } as object) : { nativeID: "dd-boot-overlay" };

  return (
    <View
      {...bootId}
      style={[styles.overlay, fading && styles.overlayFading]}
      pointerEvents="none"
    >
      {showPosterUnderlay ? <BootLockPoster /> : null}

      {mode === "paper" ? (
        <>
          <ImageBackground
            source={{ uri: BOOT_PAPER_TEXTURE_URI }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={styles.center} pointerEvents="none">
            <View style={[styles.lockBox, { width: paperW, height: paperH }]}>
              <BootLockImage width={lockW} height={lockH} />
              <View
                style={[
                  styles.lockAnimLayer,
                  { width: paperW, height: paperH, opacity: animReady ? 1 : 0 },
                ]}
              >
                <BootLockPaperVideo
                  videoMp4Uri={bootVideoPaperMp4Uri || undefined}
                  videoWebmUri={bootVideoPaperWebmUri || undefined}
                  width={paperW}
                  height={paperH}
                  onReady={() => setAnimReady(true)}
                  onFailed={onPaperFail}
                />
              </View>
            </View>
          </View>
        </>
      ) : null}

      {mode === "chroma" ? (
        <>
          <ImageBackground
            source={{ uri: BOOT_PAPER_TEXTURE_URI }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={styles.center} pointerEvents="none">
            <View style={[styles.lockBox, { width: lockW, height: lockH }]}>
              {!animReady ? <BootLockImage width={lockW} height={lockH} /> : null}
              <View
                style={[
                  styles.lockAnimLayer,
                  { width: lockW, height: lockH, opacity: animReady ? 1 : 0 },
                ]}
              >
                <BootLockCanvas
                  videoWebmUri={bootVideoWebmUri || undefined}
                  videoMp4Uri={bootVideoMp4Uri || undefined}
                  width={lockW}
                  height={lockH}
                  onReady={() => setAnimReady(true)}
                  onFailed={onChromaFail}
                />
              </View>
            </View>
          </View>
        </>
      ) : null}

      {message ? (
        <View style={styles.messageWrap}>
          <Text style={styles.message}>{message}</Text>
        </View>
      ) : null}
      {showRetry ? (
        <View style={styles.messageWrap}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            onPress={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            <Text style={styles.buttonText}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function AppBootGate({ fontsLoaded, fontError, children }: Props) {
  const [phase, setPhase] = useState<BootPhase>("playing");

  const fadeHtmlBootLayer = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const htmlLayer = document.getElementById("dd-boot-layer");
    if (!htmlLayer) return;
    htmlLayer.style.opacity = "0";
    htmlLayer.style.transition = "opacity 150ms ease";
    htmlLayer.style.pointerEvents = "none";
    window.setTimeout(() => htmlLayer.remove(), 160);
  };

  useEffect(() => {
    if (Platform.OS === "web") {
      fadeHtmlBootLayer();
    }

    const fadeTimer = setTimeout(() => setPhase("fading"), WEB_BOOT_MS);
    const hideTimer = setTimeout(() => {
      setPhase("hidden");
      if (Platform.OS === "web") fadeHtmlBootLayer();
    }, WEB_BOOT_MS + BOOT_FADE_MS + 50);
    const safetyTimer = setTimeout(() => {
      setPhase("hidden");
      if (Platform.OS === "web") fadeHtmlBootLayer();
    }, MAX_BOOT_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || phase !== "hidden") return;
    document.getElementById("dd-boot-layer")?.remove();
  }, [phase]);

  const showBoot = phase !== "hidden";
  const showChildren = Platform.OS === "web" || fontsLoaded;

  if (fontError) {
    return (
      <BootScreen
        message="Не удалось загрузить приложение"
        showRetry
      />
    );
  }

  return (
    <>
      {showChildren ? children : null}
      {showBoot ? <BootScreen fading={phase === "fading"} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    backgroundColor: BOOT_CREAM,
    opacity: 1,
  },
  overlayFading: {
    opacity: 0,
    ...(Platform.OS === "web"
      ? ({ transition: `opacity ${BOOT_FADE_MS}ms ease` } as object)
      : null),
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lockBox: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  lockAnimLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  messageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 48,
    pointerEvents: "box-none",
  },
  message: {
    marginTop: 20,
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: "#8B7355",
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#6B7B5E",
  },
  buttonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 16,
    color: BOOT_CREAM,
  },
});
