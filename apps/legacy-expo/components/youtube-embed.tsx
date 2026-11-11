// Архив Expo. Архивный YouTube adapter использует собственный /api/yt: web relative URL, native HTML с историческим доменом.
import { createElement, useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  youtubeId: string;
};

export function YouTubeEmbed({ youtubeId }: Props) {
  // Архивный YouTube adapter использует собственный /api/yt: web relative URL, native HTML с историческим доменом.

  const src = useMemo(() => /* Кодирует youtubeId в URL старого потокового proxy. */ `/api/yt/${encodeURIComponent(youtubeId)}`, [youtubeId]);
  const poster = useMemo(
    () => /* Кодирует youtubeId в маршрут старой публичной миниатюры. */ `/media/yt-thumb/${encodeURIComponent(youtubeId)}/hqdefault.jpg`,
    [youtubeId],
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.frame}>
        {createElement("video", {
          src,
          poster,
          controls: true,
          playsInline: true,
          preload: "metadata",
          style: { width: "100%", height: "100%", backgroundColor: "#000", objectFit: "contain" },
        })}
      </View>
    );
  }

  return (
    <WebView
      source={{
        html: `<!doctype html><html><body style="margin:0;background:#000"><video src="https://daryadarcy.com/api/yt/${encodeURIComponent(youtubeId)}" poster="https://daryadarcy.com/media/yt-thumb/${encodeURIComponent(youtubeId)}/hqdefault.jpg" controls playsinline style="width:100%;height:100%;object-fit:contain"></video></body></html>`,
      }}
      style={styles.frame}
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      allowsInlineMediaPlayback
    />
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  frame: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
});
