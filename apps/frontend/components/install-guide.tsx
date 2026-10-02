import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { WOOLEN_FONT } from "@/lib/brand-font";

const SEEN_KEY = "@darcy_install_guide_seen";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";

function isStandaloneWeb(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
}

function isIosWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function Step({
  icon,
  text,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        <MaterialIcons name={icon} size={18} color={BROWN} />
      </View>
      <Text style={styles.step}>{text}</Text>
    </View>
  );
}

export function InstallGuide() {
  const [visible, setVisible] = useState(false);
  const ios = isIosWeb();

  useEffect(() => {
    if (Platform.OS !== "web" || isStandaloneWeb()) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(SEEN_KEY, "1");
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Закрыть" />
        <View style={styles.card}>
          <Text style={styles.kicker}>DARYADARCY</Text>
          <Text style={styles.title}>Добавить на экран Домой</Text>
          <Text style={styles.body}>
            Так приложение открывается как обычная иконка, без адресной строки браузера.
          </Text>
          <View style={styles.steps}>
            {ios ? (
              <>
                <Step icon="ios-share" text="1. Нажмите «Поделиться» в Safari" />
                <Step icon="add-box" text="2. Выберите «На экран Домой»" />
                <Step icon="check" text="3. Подтвердите «Добавить»" />
              </>
            ) : (
              <>
                <Step icon="more-vert" text="1. Откройте меню браузера" />
                <Step icon="ios-share" text="2. Выберите «На экран Домой»" />
                <Step icon="check" text="3. Подтвердите «Добавить»" />
              </>
            )}
          </View>
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="home" size={18} color={BROWN} />
            <Text style={styles.buttonText}>Понятно →</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(60, 42, 26, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: CREAM,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  kicker: {
    fontFamily: WOOLEN_FONT,
    letterSpacing: 2,
    fontSize: 20,
    color: BROWN_MUTED,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "EBGaramond-Bold",
    fontSize: 22,
    color: BROWN,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: BROWN,
    textAlign: "center",
    marginBottom: 14,
  },
  steps: {
    gap: 10,
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(245, 237, 224, 0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  step: {
    flex: 1,
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    lineHeight: 22,
    color: BROWN,
  },
  button: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 237, 224, 0.95)",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN,
    letterSpacing: 0.6,
  },
});
