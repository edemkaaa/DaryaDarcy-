import { ScrollView, Text, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { WOOLEN_FONT } from "@/lib/brand-font";
import type { LegalDocument } from "@shared/legal-documents";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";

type Props = {
  document: LegalDocument;
};

export function LegalDocumentScreen({ document }: Props) {
  const { width } = useWindowDimensions();
  const imageWidth = Math.min(width - 48, 480);

  return (
    <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.kicker}>DARYADARCY</Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.date}>Клуб Darcy · {document.date}</Text>
        {document.imageUrl ? (
          <Image
            source={{ uri: document.imageUrl }}
            style={[styles.licenseImage, { width: imageWidth, height: imageWidth * 1.35 }]}
            contentFit="contain"
            accessibilityLabel={document.title}
          />
        ) : null}
        {document.sections.map((section) => (
          <View key={section.title} style={styles.block}>
            <Text style={styles.heading}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

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
  date: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  block: {
    marginBottom: 18,
    gap: 8,
  },
  heading: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 17,
    color: BROWN,
  },
  body: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN,
    lineHeight: 22,
  },
  licenseImage: {
    alignSelf: "center",
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
});
