import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

type Props = {
  isLoading: boolean;
  isError: boolean;
  hasData?: boolean;
  onRetry: () => void;
  message?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
};

const OLIVE = "#6B7B5E";
const BROWN_MUTED = "#8B7355";

export function QueryRetryState({
  isLoading,
  isError,
  hasData = false,
  onRetry,
  message = "Не удалось загрузить данные",
  style,
  children,
}: Props) {
  if (isLoading && !hasData) {
    return (
      <View style={[styles.center, style]}>
        <ActivityIndicator size="large" color={OLIVE} />
        <Text style={styles.hint}>Загрузка…</Text>
      </View>
    );
  }

  if (isError && !hasData) {
    return (
      <View style={[styles.center, style]}>
        <Text style={styles.message}>{message}</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          onPress={onRetry}
        >
          <Text style={styles.buttonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  hint: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
  },
  message: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN_MUTED,
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: OLIVE,
  },
  buttonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 16,
    color: "#FDF8F0",
  },
});
