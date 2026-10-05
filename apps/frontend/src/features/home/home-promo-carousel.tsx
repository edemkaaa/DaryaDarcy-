"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getHomePromoCarouselLayout } from "./home-promo-carousel.layout";
import classes from "./home-promo-carousel.module.scss";
import { Action, Background } from "@/shared/ui/elements";
import { useEffect, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "@/shared/browser/motion";
import { HOME_PROMO_SLIDES } from "@/features/home/promo-slides";
import {
  PAPER_TEXTURE_URI,
  INTERVAL_MS,
  FADE_MS,
} from "./home-promo-carousel.content";
export function HomePromoCarousel() {
  const viewport = useViewport();
  const { stylesLayout } = getHomePromoCarouselLayout(viewport);

  const router = useRouter();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slide = HOME_PROMO_SLIDES[index];
  useEffect(() => {
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    timerRef.current = setInterval(() => {
      if (document.hidden) return;
      opacity.value = withTiming(0, {
        duration: FADE_MS / 2,
        easing: Easing.inOut(Easing.ease),
      });
      transitionTimer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % HOME_PROMO_SLIDES.length);
        opacity.value = withTiming(1, {
          duration: FADE_MS / 2,
          easing: Easing.inOut(Easing.ease),
        });
      }, FADE_MS / 2);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(transitionTimer);
    };
  }, [opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <div className={["ui-stack ", classes.wrap].filter(Boolean).join(" ")}>
      <Action
        onClick={() => router.push(slide.route)}
        role="button"
        aria-label={`Перейти: ${slide.label}`}
        className={({ pressed }) =>
          [classes.pressed, pressed ? classes.opacityState : ""]
            .filter(Boolean)
            .join(" ")
        }
      >
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          style={{
            width: stylesLayout.card.width,
            height: stylesLayout.card.height,
          }}
          className={classes.card}
          imageClassName={classes.cardPaper}
        >
          <Animated.div style={fadeStyle} className={classes.div}>
            <Picture
              key={slide.id}
              source={slide.image}
              contentFit="contain"
              className={classes.image}
            />
          </Animated.div>
        </Background>
      </Action>

      <div className={["ui-stack ", classes.dots].filter(Boolean).join(" ")}>
        {HOME_PROMO_SLIDES.map((item, i) => (
          <div
            key={item.id}
            className={[
              ["ui-stack ", classes.dotActive].filter(Boolean).join(" "),
              i === index
                ? classes.backgroundColorState
                : classes.backgroundColorState2,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
