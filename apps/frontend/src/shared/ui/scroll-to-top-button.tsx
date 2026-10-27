"use client";
import classes from "./scroll-to-top-button.module.scss";
import { Action } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import Animated, { FadeIn, FadeOut } from "@/shared/browser/motion";
import { useEffect, useState, type RefObject } from "react";
const CREAM_BG = "#FDF8F0";
interface ScrollToTopButtonProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  onScrollToTop?: () => Promise<boolean>;
}
export function ScrollToTopButton({
  scrollRef,
  onScrollToTop,
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
      className={classes.div}
    >
      <Action
        aria-label="Наверх"
        onClick={async () => {
          const scroll = scrollRef.current;
          if (scroll?.hasAttribute("data-windowed-collection"))
            scroll.dataset.collectionScrollTarget = "start";
          if (onScrollToTop && !(await onScrollToTop())) {
            if (scroll) delete scroll.dataset.collectionScrollTarget;
            return;
          }
          scroll?.scrollTo({
            top: 0,
            behavior: onScrollToTop ? "instant" : "smooth",
          });
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
