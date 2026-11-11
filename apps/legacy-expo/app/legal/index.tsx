// Архив Expo. Показывает общие юридические ссылки проекта с внутренней навигацией.
import { ScrollView, Text, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { WOOLEN_FONT } from "@/lib/brand-font";
import { LEGAL_HUB_LINKS } from "@shared/legal-documents";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";

export default function LegalHubScreen() {
  // Показывает общие юридические ссылки проекта с внутренней навигацией.

  return (
    <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.kicker}>DARYADARCY</Text>
        <Text style={styles.title}>Юридические документы</Text>
        <Text style={styles.subtitle}>Клуб Darcy · daryadarcy.com</Text>
        <Pressable onPress={() => router.push("/privacy")} style={styles.linkRow}>
          <Text style={styles.linkText}>Политика конфиденциальности</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
        {LEGAL_HUB_LINKS.map((item) => (
          <Pressable
            key={item.slug}
            onPress={() => router.push(`/legal/${item.slug}` as any)}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>{item.label}</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 8,
  },
  back: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  backText: {
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    fontSize: 15,
  },
  kicker: {
    letterSpacing: 2,
    textAlign: "center",
    color: BROWN_MUTED,
    fontFamily: WOOLEN_FONT,
    fontSize: 22,
    marginTop: 8,
  },
  title: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 26,
    color: BROWN,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(139,115,85,0.25)",
  },
  linkText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    flex: 1,
    paddingRight: 12,
  },
  arrow: {
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    fontSize: 18,
  },
});
