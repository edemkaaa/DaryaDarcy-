"use client";
import classes from "./photo-viewer.module.scss";
import { cssTransform } from "@/shared/ui/css";
import {
  type ScrollEvent,
  Dialog,
  Action,
  Typography,
  ScrollArea,
} from "@/shared/ui/elements";
import { useViewport } from "@/shared/browser/viewport";
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { useSafeAreaInsets } from "@/shared/ui/safe-area";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "@/shared/browser/motion";
import { Gesture, GestureDetector } from "@/shared/browser/gestures";
interface PhotoViewerProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}
export function PhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: PhotoViewerProps) {
  if (!visible || photos.length === 0) return null;
  return (
    <PhotoViewerInner
      key={`${initialIndex}-${photos[0] ?? ""}`}
      photos={photos}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
}
function PhotoViewerInner({
  photos,
  initialIndex = 0,
  onClose,
}: Omit<PhotoViewerProps, "visible">) {
  const { width: screenWidth, height: screenHeight } = useViewport();
  const insets = useSafeAreaInsets();
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(photos.length - 1, 0),
  );
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(safeInitialIndex);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const handleClose = useCallback(() => {
    onClose();
    translateY.value = 0;
    opacity.value = 1;
  }, [onClose, opacity, translateY]);
  useLayoutEffect(() => {
    const preservedIndex = Math.min(currentIndexRef.current, photos.length - 1);
    currentIndexRef.current = preservedIndex;
    setCurrentIndex(preservedIndex);
    const offset = preservedIndex * screenWidth;
    scrollRef.current?.scrollTo({ left: offset, top: 0, behavior: "instant" });
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        left: offset,
        top: 0,
        behavior: "instant",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [screenWidth, photos.length]);
  const panGesture = Gesture.Pan()
    .activeOffsetY(28)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = 1 - Math.min(e.translationY / 400, 0.6);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 150) {
        translateY.value = withTiming(screenHeight, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ translateY: translateY.value }]),
  }));
  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  const updateIndexFromOffset = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / screenWidth);
      if (index >= 0 && index < photos.length) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
      }
    },
    [photos.length, screenWidth],
  );
  const onScrollEnd = useCallback(
    (event: ScrollEvent) => {
      updateIndexFromOffset(event.currentTarget.scrollLeft);
    },
    [updateIndexFromOffset],
  );
  const imageHeight = screenHeight * 0.8;
  return (
    <Dialog open motion="fade" onClose={handleClose}>
      <Animated.div style={animatedBgStyle} className={classes.div} />
      <GestureDetector gesture={panGesture}>
        <Animated.div style={animatedContainerStyle} className={classes.div2}>
          <Action
            onClick={handleClose}
            style={{ top: insets.top + 10 }}
            className={classes.action}
          >
            <MaterialIcons name="close" size={26} color="#fff" />
          </Action>

          {photos.length > 1 && (
            <div
              style={{ top: insets.top + 14 }}
              className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
            >
              <Typography className={classes.counterText}>
                {currentIndex + 1} / {photos.length}
              </Typography>
            </div>
          )}

          <ScrollArea
            ref={scrollRef}
            horizontal
            paging
            hideScrollbar
            snapInterval={screenWidth}
            onScrollSettled={onScrollEnd}
            contentStyle={{ width: screenWidth * photos.length }}
            className={classes.scroll}
          >
            {photos.map((uri, index) => (
              <div
                key={`${index}-${uri}`}
                style={{ width: screenWidth, height: screenHeight }}
                className={["ui-stack ", classes.div4]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Picture
                  source={{ uri }}
                  style={{ width: screenWidth, height: imageHeight }}
                  contentFit="contain"
                  transition={150}
                />
              </div>
            ))}
          </ScrollArea>

          {photos.length > 1 && photos.length <= 10 && (
            <div
              style={{ bottom: insets.bottom + 30 }}
              className={["ui-stack ", classes.div5].filter(Boolean).join(" ")}
            >
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "ui-stack ",
                    i === currentIndex
                      ? classes.appearanceState
                      : classes.appearanceState2,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </div>
          )}
        </Animated.div>
      </GestureDetector>
    </Dialog>
  );
}
