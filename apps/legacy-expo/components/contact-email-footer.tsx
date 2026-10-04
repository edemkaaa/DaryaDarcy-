import { Linking, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { PUBLIC_CONTACT_EMAIL } from "@shared/contact";

type Props = {
  hint?: string;
  style?: ViewStyle;
};

export function ContactEmailFooter({
  hint = "Если письмо не пришло в течение 15 минут или нужна помощь — напишите нам:",
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.hint}>{hint}</Text>
      <Pressable onPress={() => void Linking.openURL(`mailto:${PUBLIC_CONTACT_EMAIL}`)}>
        <Text style={styles.email}>{PUBLIC_CONTACT_EMAIL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  hint: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 12,
    color: "#8B7355",
    textAlign: "center",
    lineHeight: 16,
  },
  email: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 13,
    color: "#6B7B5E",
    textDecorationLine: "underline",
  },
});
