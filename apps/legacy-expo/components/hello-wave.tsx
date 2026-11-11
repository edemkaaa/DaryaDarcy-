// Архив Expo. Запускает ограниченную четырьмя повторами декларативную анимацию приветствия.
import Animated from "react-native-reanimated";

export function HelloWave() {
  // Запускает ограниченную четырьмя повторами декларативную анимацию приветствия.

  return (
    <Animated.Text
      style={{
        fontSize: 28,
        lineHeight: 32,
        marginTop: -6,
        animationName: {
          "50%": { transform: [{ rotate: "25deg" }] },
        },
        animationIterationCount: 4,
        animationDuration: "300ms",
      }}
    >
      👋
    </Animated.Text>
  );
}
