import { Text, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { LegalDocumentScreen } from "@/components/legal-document-screen";
import { LEGAL_DOCUMENTS } from "@shared/legal-documents";

export default function LegalDocumentRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const document = slug ? LEGAL_DOCUMENTS[slug] : undefined;

  if (!document) {
    return (
      <ScreenContainer containerClassName="bg-[#FDF8F0]">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.error}>Документ не найден</Text>
      </ScreenContainer>
    );
  }

  return <LegalDocumentScreen document={document} />;
}

const styles = StyleSheet.create({
  back: {
    padding: 24,
  },
  backText: {
    fontFamily: "EBGaramond-Regular",
    color: "#8B7355",
    fontSize: 15,
  },
  error: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 18,
    color: "#5C4033",
    textAlign: "center",
    marginTop: 40,
  },
});
