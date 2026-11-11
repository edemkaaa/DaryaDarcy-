// Архив Expo. Накладывает две внутренние ссылки на локальную графику папки с фиксированными пропорциями.
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

const FOLDER_IMAGE = require("@/assets/images/legal-documents-folder.webp");
const FOLDER_ASPECT = 1024 / 819;
const FOLDER_WIDTH = 196;

type Props = {
  style?: ViewStyle;
};

/** Footer links on the legal-documents folder graphic. */
export function LegalDocumentsFooter({ style }: Props) {
  // Накладывает две внутренние ссылки на локальную графику папки с фиксированными пропорциями.

  const router = useRouter();
  const folderHeight = FOLDER_WIDTH / FOLDER_ASPECT;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.folderFrame, { width: FOLDER_WIDTH, height: folderHeight }]}>
        <Image source={FOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="contain" />
        <View style={styles.textOverlay}>
          <Pressable
            onPress={() => router.push("/legal" as any)}
            style={({ pressed }) => [styles.linkBlock, pressed && styles.linkPressed]}
          >
            <Text style={styles.linkLine}>Юридические</Text>
            <Text style={styles.linkLine}>документы →</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/privacy" as any)}
            style={({ pressed }) => [styles.linkBlock, pressed && styles.linkPressed]}
          >
            <Text style={styles.linkLine}>Политика</Text>
            <Text style={styles.linkLine}>конфиденциальности →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  folderFrame: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  textOverlay: {
    position: "absolute",
    left: "13%",
    right: "13%",
    top: "36%",
    bottom: "16%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  linkBlock: {
    alignItems: "center",
  },
  linkPressed: {
    opacity: 0.75,
  },
  linkLine: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#F3E8D0",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
