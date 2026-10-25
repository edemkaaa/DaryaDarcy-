"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getHomePromoCarouselLayout } from "./home-promo-carousel.layout";
import classes from "./home-promo-carousel.module.scss";
import { Action, Background } from "@/shared/ui/elements";
import { useCallback, useEffect, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { useScreenActive } from "@/shared/navigation/screen-activity";
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

type Swipe = {
  pointerId: number;
  target: HTMLButtonElement;
  x: number;
  y: number;
  lastX: number;
  axis: "horizontal" | "vertical" | null;
};

export function HomePromoCarousel() {
  const active = useScreenActive();
  const viewport = useViewport();
  const { stylesLayout } = getHomePromoCarouselLayout(viewport);

  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const opacity = useSharedValue(1);
  const swipe = useRef<Swipe | null>(null);
  const suppressClick = useRef(false);
  const slide = HOME_PROMO_SLIDES[index];

  const finishSwipe = useCallback((cancelled = false) => {
    const current = swipe.current;
    if (!current) return;
    swipe.current = null;
    const distance = current.lastX - current.x;
    const threshold = Math.max(
      40,
      Math.min(current.target.clientWidth * 0.15, 100),
    );
    if (
      !cancelled &&
      current.axis === "horizontal" &&
      Math.abs(distance) >= threshold
    ) {
      setIndex(
        (prev) =>
          (prev + (distance < 0 ? 1 : -1) + HOME_PROMO_SLIDES.length) %
          HOME_PROMO_SLIDES.length,
      );
    }
    setInteracting(false);
    if (current.target.hasPointerCapture(current.pointerId)) {
      current.target.releasePointerCapture(current.pointerId);
    }
  }, []);

  useEffect(() => {
    const cancel = () => finishSwipe(true);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
    };
  }, [finishSwipe]);

  useEffect(() => {
    if (interacting || !active) return;
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
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
      clearInterval(timer);
      clearTimeout(transitionTimer);
      opacity.value = 1;
    };
  }, [opacity, interacting, active]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <div className={["ui-stack ", classes.wrap].filter(Boolean).join(" ")}>
      <Action
        pressFeedback={false}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || swipe.current) return;
          suppressClick.current = false;
          swipe.current = {
            pointerId: event.pointerId,
            target: event.currentTarget,
            x: event.clientX,
            y: event.clientY,
            lastX: event.clientX,
            axis: null,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          opacity.value = 1;
          setInteracting(true);
        }}
        onPointerMove={(event) => {
          const current = swipe.current;
          if (!current || event.pointerId !== current.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          current.lastX = event.clientX;
          if (!current.axis && Math.hypot(dx, dy) > 8) {
            current.axis =
              Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
            suppressClick.current = true;
          }
          // Touch direction is handled by touch-action; keep native taps intact.
          if (current.axis === "horizontal" && event.pointerType === "mouse")
            event.preventDefault();
        }}
        onPointerUp={(event) => {
          if (swipe.current?.pointerId === event.pointerId) finishSwipe();
        }}
        onPointerCancel={() => finishSwipe(true)}
        onLostPointerCapture={() => finishSwipe(true)}
        onClickCapture={(event) => {
          if (event.detail && suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
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
              loading="eager"
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
