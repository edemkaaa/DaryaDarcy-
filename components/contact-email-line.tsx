import { Linking, Pressable, StyleSheet, Text, type TextStyle } from "react-native";
import { PUBLIC_CONTACT_EMAIL } from "@/shared/contact";

type Props = {
  prefix?: string;
  style?: TextStyle;
  linkStyle?: TextStyle;
};

export function ContactEmailLine({
  prefix = "Вопросы и поддержка:",
  style,
  linkStyle,
}: Props) {
  return (
    <Text style={[styles.text, style]}>
      {prefix}{" "}
      <Pressable onPress={() => void Linking.openURL(`mailto:${PUBLIC_CONTACT_EMAIL}`)}>
        <Text style={[styles.link, linkStyle]}>{PUBLIC_CONTACT_EMAIL}</Text>
      </Pressable>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: "#8B7355",
    lineHeight: 18,
    textAlign: "center",
  },
  link: {
    fontFamily: "EBGaramond-SemiBold",
    color: "#6B7B5E",
    textDecorationLine: "underline",
  },
});
