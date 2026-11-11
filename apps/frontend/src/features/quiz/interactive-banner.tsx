"use client";
/** Баннер интерактива отделён от содержимого раздела, чтобы декоративная часть не владела состоянием теста. */
import { Picture } from "@/shared/media/image";
import { Typography } from "@/shared/ui/elements";
import Animated, { FadeIn } from "@/shared/browser/motion";
import classes from "./interactive-screen.module.scss";
const keyDecor = { uri: "/assets/interactive/key-decor.webp" };
const ivyLeft = { uri: "/assets/interactive/ivy-left.webp" };
const ivyRight = { uri: "/assets/interactive/ivy-right.webp" };
export function InteractiveBanner() {
  const content = (
    <>
      {/* Key centered on top */}
      <Picture
        source={keyDecor}
        contentFit="contain"
        className={classes.keyDecor}
      />
      {/* Title */}
      <Typography className={classes.headerTitle}>ИНТЕРАКТИВ</Typography>
      {/* Subtitle */}
      <Typography className={classes.headerSubtitle}>
        тесты, игры, творческие задания
      </Typography>

      {/* Ivy branches - absolute, visible here, tails extend below */}
      <Picture
        source={ivyRight}
        contentFit="contain"
        className={classes.ivyLeft}
      />
      <Picture
        source={ivyLeft}
        contentFit="contain"
        className={classes.ivyRight}
      />
    </>
  );
  return (
    <Animated.div
      entering={FadeIn.duration(600)}
      className={classes.headerSection}
    >
      {content}
    </Animated.div>
  );
}
