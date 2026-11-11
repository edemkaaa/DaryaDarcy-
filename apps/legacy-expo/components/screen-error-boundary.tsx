// Архив Expo. Переводит render-сбой потомка в локальное fallback-состояние экрана.
import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: ReactNode;
  message?: string;
  onRetry?: () => void;
};

type State = {
  error: Error | null;
};

/** Catches render errors so Safari/WebKit does not reload the page in a crash loop. */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // Переводит render-сбой потомка в локальное fallback-состояние экрана.

    return { error };
  }

  componentDidCatch(error: Error) {
    // Пишет подробность render-ошибки только в development.

    if (__DEV__) {
      console.error("[ScreenErrorBoundary]", error);
    }
  }

  private handleRetry = () => {
    // Снимает локальную ошибку и вызывает необязательную повторную загрузку владельца.

    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    // Выбирает fallback с повтором либо исходных потомков; асинхронные ошибки boundary не ловит.

    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>{this.props.message || "Не удалось показать раздел"}</Text>
          <Text style={styles.body}>Обновите страницу или попробуйте ещё раз.</Text>
          <Pressable onPress={this.handleRetry} style={styles.btn}>
            <Text style={styles.btnText}>Повторить</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "#FDF8F0",
  },
  title: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 18,
    color: "#4A3728",
    textAlign: "center",
  },
  body: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: "#7A6B5E",
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#8B7355",
  },
  btnText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 15,
    color: "#FDF8F0",
  },
});
