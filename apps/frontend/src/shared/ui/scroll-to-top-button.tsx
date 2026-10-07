"use client";
import classes from "./scroll-to-top-button.module.scss";
import { Action } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import Animated, { FadeIn, FadeOut } from "@/shared/browser/motion";
import { useEffect, useState, type RefObject } from "react";
const CREAM_BG = "#FDF8F0";
interface ScrollToTopButtonProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Distance from bottom edge (above tab bars / FAB stacks). */
  bottom?: number;
}
export function ScrollToTopButton({
  scrollRef,
  bottom = 90,
}: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const update = () => setVisible(scroll.scrollTop > 360);
    update();
    scroll.addEventListener("scroll", update, { passive: true });
    return () => scroll.removeEventListener("scroll", update);
  }, [scrollRef]);
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
          const scroll = scrollRef.current;
          if (scroll?.hasAttribute("data-windowed-collection"))
            scroll.dataset.collectionScrollTarget = "start";
          scroll?.scrollTo({ top: 0, behavior: "smooth" });
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
