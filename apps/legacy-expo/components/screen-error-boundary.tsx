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
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.error("[ScreenErrorBoundary]", error);
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
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
