"use client";
import { useViewport } from "@/shared/browser/viewport";

import type { CSSProperties, PointerEvent } from "react";
import classes from "./shelf-item.module.scss";
import { cssTransform, mergeStyles } from "@/shared/ui/css";
import { Action } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "@/shared/browser/motion";
import { pressableProps } from "@/shared/browser/press";

import { getShopScreenContent } from "./shop-screen.content";
import type { Product } from "./shop-screen.content";
export function ShelfItem({
  product,
  onClick,
  width,
  height,
  style,
}: {
  product: Product;
  onClick: () => void;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  const viewport = useViewport();
  const { BOOK_WIDTH, BOOK_HEIGHT } = getShopScreenContent(viewport);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ scale: scale.value }]),
  }));
  const handlePressIn = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    scale.value = withTiming(0.93, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };
  return (
    <Action
      aria-label={`Открыть товар: ${product.title}`}
      {...pressableProps(onClick)}
      onPointerDown={handlePressIn}
      onPointerUp={handlePressOut}
      onPointerCancel={handlePressOut}
      onPointerLeave={handlePressOut}
      style={mergeStyles(style)}
      className={classes.item}
    >
      <Animated.div className={classes.imageMotion} style={animatedStyle}>
        <Picture
          source={{ uri: product.imageUrl }}
          style={{ width: width || BOOK_WIDTH, height: height || BOOK_HEIGHT }}
          contentFit="contain"
          transition={300}
        />
      </Animated.div>
    </Action>
  );
}
