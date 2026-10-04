"use client";
import classes from "./garden-confetti.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "@/shared/browser/motion";
import { PETALS } from "./garden-confetti.content";
import type { Petal } from "./garden-confetti.content";
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
    transform: cssTransform([
      { translateX: petal.driftX * progress.value },
      { translateY: petal.driftY * progress.value },
      { rotate: `${petal.rotate + progress.value * 120}deg` },
      { scale: 1 - progress.value * 0.35 },
    ]),
  }));
  if (!active) return null;
  return (
    <Animated.div
      style={[
        {
          left: `${petal.left}%`,
          top: `${petal.top}%`,
          width: petal.size,
          height: petal.size * 1.4,
          backgroundColor: petal.color,
          borderRadius: petal.size,
        },
        style,
        { pointerEvents: "none" },
      ]}
      className={classes.div}
    />
  );
}
export function GardenConfetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className={["ui-stack  ui-pointer-none", classes.div2]
        .filter(Boolean)
        .join(" ")}
    >
      {PETALS.map((petal) => (
        <ConfettiPetal key={petal.id} petal={petal} active={active} />
      ))}
    </div>
  );
}
