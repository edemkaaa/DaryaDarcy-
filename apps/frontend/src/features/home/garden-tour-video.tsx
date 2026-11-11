"use client";
/** Тур по саду создаёт проигрыватель после нажатия; появление секции и декоративный эффект не подтверждают загрузку видео. */
import classes from "./garden-tour-video.module.scss";
import { Action, Typography, type LayoutRect } from "@/shared/ui/elements";
import { useEffect, useState, useCallback } from "react";
import { Picture } from "@/shared/media/image";
import { ManagedVideo } from "@/shared/media/managed-video";
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from "@/shared/browser/motion";
import { GardenConfetti } from "@/features/home/garden-confetti";
import {
  GARDEN_VIDEO_URL,
  GARDEN_POSTER_URL,
} from "./garden-tour-video.content";
function GardenPoster({ onClick }: { onClick: () => void }) {
  return (
    <div className={["ui-stack ", classes.frame].filter(Boolean).join(" ")}>
      <Picture
        source={{ uri: GARDEN_POSTER_URL }}
        contentFit="cover"
        className={classes.picture}
      />
      <Action
        onClick={onClick}
        role="button"
        aria-label="Смотреть тур по моему саду"
        className={({ pressed }) =>
          [classes.action, pressed ? classes.opacityState : ""]
            .filter(Boolean)
            .join(" ")
        }
      >
        <Typography className={classes.watchBtnText}>
          Смотреть тур по моему саду →
        </Typography>
      </Action>
    </div>
  );
}
export function GardenTourVideo() {
  const [isPlaying, setIsPlaying] = useState(false);
  if (!isPlaying) {
    return <GardenPoster onClick={() => setIsPlaying(true)} />;
  }
  return (
    <div className={["ui-stack ", classes.frame].filter(Boolean).join(" ")}>
      <ManagedVideo
        src={GARDEN_VIDEO_URL}
        poster={GARDEN_POSTER_URL}
        controls
        playsInline
        autoPlay
        preload="metadata"
        className={classes.videoElement}
      />
    </div>
  );
}
type SectionProps = {
  scrollY?: SharedValue<number>;
  viewportHeight?: number;
};
export function GardenTourSection({
  scrollY,
  viewportHeight = 800,
}: SectionProps) {
  const [layoutY, setLayoutY] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const triggerReveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    setConfetti(true);
    setTimeout(() => setConfetti(false), 1600);
  }, [revealed]);
  useAnimatedReaction(
    () => scrollY?.value ?? 0,
    (y) => {
      if (revealed || !scrollY) return;
      if (layoutY > 0 && y + viewportHeight > layoutY + 80) {
        runOnJS(triggerReveal)();
      }
    },
    [layoutY, revealed, viewportHeight],
  );
  useEffect(() => {
    if (scrollY) return;
    const timer = setTimeout(triggerReveal, 400);
    return () => clearTimeout(timer);
  }, [scrollY, triggerReveal]);
  const onResize = (event: LayoutRect) => {
    setLayoutY(event.y);
  };
  return (
    <Animated.div
      entering={
        revealed ? FadeInDown.duration(650).springify().damping(18) : undefined
      }
      onResize={onResize}
      className={classes.section}
    >
      <GardenConfetti active={confetti} />
      <Typography className={classes.title}>
        <Typography className={classes.titleLead}>Вы нашли{"\n"}</Typography>
        <Typography className={classes.titleMain}>ТАИНСТВЕННЫЙ САД</Typography>
      </Typography>
      <GardenTourVideo />
    </Animated.div>
  );
}
