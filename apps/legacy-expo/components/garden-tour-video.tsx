// Архив Expo. Показывает кешируемую обложку и запускает видео только по жесту пользователя.
import { createElement, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";
import { GardenConfetti } from "@/components/garden-confetti";

export const GARDEN_VIDEO_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/home/secret-garden.mp4";
export const GARDEN_POSTER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/home/secret-garden-poster.webp";

let VideoView: any = null;
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

function GardenPoster({ onPress }: { onPress: () => void }) {
  // Показывает кешируемую обложку и запускает видео только по жесту пользователя.

  return (
    <View style={styles.frame}>
      <Image
        source={{ uri: GARDEN_POSTER_URL }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey="garden-poster"
      />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.watchBtn, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
        accessibilityLabel="Смотреть тур по моему саду"
      >
        <Text style={styles.watchBtnText}>Смотреть тур по моему саду →</Text>
      </Pressable>
    </View>
  );
}

export function GardenTourVideo() {
  // Выбирает poster, HTML video либо native player с одним фиксированным источником сада.

  const [isPlaying, setIsPlaying] = useState(false);

  if (!isPlaying) {
    return <GardenPoster onPress={() => setIsPlaying(true)} />;
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.frame}>
        {createElement("video", {
          src: GARDEN_VIDEO_URL,
          poster: GARDEN_POSTER_URL,
          controls: true,
          playsInline: true,
          autoPlay: true,
          preload: "metadata",
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: "#2A2A2A",
            objectFit: "cover",
          },
        })}
      </View>
    );
  }

  if (VideoView && useVideoPlayer) {
    return <NativeGardenPlayer />;
  }

  return <GardenPoster onPress={() => setIsPlaying(true)} />;
}

function NativeGardenPlayer() {
  // Создаёт native player без loop и передаёт системные controls Expo VideoView.

  const player = useVideoPlayer(GARDEN_VIDEO_URL, (p: any) => {
    p.loop = false;
  });

  useEffect(() => {
    // Запускает native video после создания player.

    player.play();
  }, [player]);

  return (
    <View style={styles.frame}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsFullscreen
        nativeControls
        contentFit="cover"
      />
    </View>
  );
}

type SectionProps = {
  scrollY?: SharedValue<number>;
  viewportHeight?: number;
};

export function GardenTourSection({ scrollY, viewportHeight = 800 }: SectionProps) {
  // Открывает сад при попадании секции в область просмотра и кратко показывает конфетти.

  const [layoutY, setLayoutY] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const triggerReveal = () => {
    // Однократно отмечает reveal и ставит таймер снятия конфетти.

    if (revealed) return;
    setRevealed(true);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1600);
  };

  useAnimatedReaction(
    () => /* Читает scrollY на UI-потоке; reaction вызывает reveal в JS после достижения порога секции. */ scrollY?.value ?? 0,
    (y) => {
      if (revealed || !scrollY) return;
      if (layoutY > 0 && y + viewportHeight > layoutY + 80) {
        runOnJS(triggerReveal)();
      }
    },
    [layoutY, revealed, viewportHeight],
  );

  useEffect(() => {
    // Без внешнего scrollY открывает секцию через 400 мс и снимает таймер при unmount.

    if (scrollY) return;
    const timer = setTimeout(triggerReveal, 400);
    return () => clearTimeout(timer);
  }, [scrollY]);

  const onLayout = (event: LayoutChangeEvent) => {
    // Запоминает вертикальную позицию секции для сравнения с scrollY.

    setLayoutY(event.nativeEvent.layout.y);
  };

  return (
    <Animated.View
      entering={revealed ? FadeInDown.duration(650).springify().damping(18) : undefined}
      onLayout={onLayout}
      style={styles.section}
    >
      <GardenConfetti active={confetti} />
      <Text style={styles.title}>
        <Text style={styles.titleLead}>Вы нашли{"\n"}</Text>
        <Text style={styles.titleMain}>ТАИНСТВЕННЫЙ САД</Text>
      </Text>
      <GardenTourVideo />
    </Animated.View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
    alignItems: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
    lineHeight: 30,
  },
  titleLead: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 22,
    letterSpacing: 0.4,
    color: "#4A3728",
  },
  titleMain: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 24,
    letterSpacing: 1.2,
    color: "#4A3728",
  },
  frame: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    borderRadius: 8,
  },
  watchBtn: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: "rgba(245, 237, 224, 0.85)",
    maxWidth: "88%",
  },
  watchBtnText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: "#4A3728",
    letterSpacing: 1,
    lineHeight: 18,
  },
});
