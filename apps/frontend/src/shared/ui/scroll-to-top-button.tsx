"use client";
import classes from "./scroll-to-top-button.module.scss";
import { Action } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import Animated, { FadeIn, FadeOut } from "@/shared/browser/motion";
const CREAM_BG = "#FDF8F0";
interface ScrollToTopButtonProps {
  visible: boolean;
  onClick: () => void;
  /** Distance from bottom edge (above tab bars / FAB stacks). */
  bottom?: number;
}
export function ScrollToTopButton({
  visible,
  onClick,
  bottom = 90,
}: ScrollToTopButtonProps) {
  if (!visible) return null;
  return (
    <Animated.div
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={{ bottom: bottom }}
      className={classes.div}
    >
      <Action
        aria-label="Наверх"
        onClick={() => {
          onClick();
        }}
        className={({ pressed }) =>
          [
            classes.btnPressed,
            pressed ? classes.opacityState : "",
            pressed ? classes.transformState : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <MaterialIcons name="keyboard-arrow-up" size={28} color={CREAM_BG} />
      </Action>
    </Animated.div>
  );
}
