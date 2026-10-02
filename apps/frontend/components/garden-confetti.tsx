import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const PETAL_COLORS = ["#6B7B5E", "#8B7355", "#D4C4A8", "#C9A882", "#FDF8F0", "#A8B89A"];

type Petal = {
  id: number;
  left: number;
  top: number;
  color: string;
  size: number;
  rotate: number;
  driftX: number;
  driftY: number;
  delay: number;
};

const PETALS: Petal[] = Array.from({ length: 18 }, (_, id) => ({
  id,
  left: 8 + (id * 17) % 84,
  top: 10 + (id * 23) % 70,
  color: PETAL_COLORS[id % PETAL_COLORS.length]!,
  size: 6 + (id % 4) * 2,
  rotate: (id * 37) % 360,
  driftX: ((id % 5) - 2) * 18,
  driftY: -40 - (id % 6) * 12,
  delay: (id % 7) * 40,
}));

function ConfettiPetal({ petal, active }: { petal: Petal; active: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    progress.value = 0;
    progress.value = withDelay(
      petal.delay,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );
  }, [active, petal.delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.85,
    transform: [
      { translateX: petal.driftX * progress.value },
      { translateY: petal.driftY * progress.value },
      { rotate: `${petal.rotate + progress.value * 120}deg` },
      { scale: 1 - progress.value * 0.35 },
    ],
  }));

  if (!active) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.petal,
        {
          left: `${petal.left}%`,
          top: `${petal.top}%`,
          width: petal.size,
          height: petal.size * 1.4,
          backgroundColor: petal.color,
          borderRadius: petal.size,
        },
        style,
      ]}
    />
  );
}

export function GardenConfetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PETALS.map((petal) => (
        <ConfettiPetal key={petal.id} petal={petal} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  petal: {
    position: "absolute",
  },
});
