// Архив Expo. Сохраняет пропорции прозрачной папки и приглушает ещё не включённый сезон.
import { View, StyleSheet } from "react-native";
import { Image, type ImageSource } from "expo-image";

type Props = {
  source: ImageSource;
  enabled: boolean;
  size?: number;
};

export function SeasonFolder({ source, enabled, size = 78 }: Props) {
  // Сохраняет пропорции прозрачной папки и приглушает ещё не включённый сезон.

  const h = Math.round(size * 0.78);
  return (
    <View style={[styles.wrap, { width: size, height: h }]}>
      <Image
        source={source}
        style={[styles.image, !enabled && styles.imageDisabled]}
        contentFit="contain"
      />
    </View>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent" },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  imageDisabled: { opacity: 0.5 },
});
