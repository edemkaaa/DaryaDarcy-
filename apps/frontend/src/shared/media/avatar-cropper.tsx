"use client";
/** Обрезка аватара создаёт отдельный результат по выбранной области; исходный файл и действие сохранения остаются раздельными. */
import { useViewport } from "@/shared/browser/viewport";

import classes from "./avatar-cropper.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Typography, Action } from "@/shared/ui/elements";

import { useState } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { useSessionOperation } from "@/domain/session/use-session-operation";
import { StatusNotice } from "@/shared/ui/status-notice";
import { Picture } from "@/shared/media/image";
import { Gesture, GestureDetector } from "@/shared/browser/gestures";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "@/shared/browser/motion";
import * as ImageManipulator from "@/shared/media/canvas-image";

// ─── Types ──────────────────────────────────────────────────────────────────
interface AvatarCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}
// ─── Component ──────────────────────────────────────────────────────────────
export function AvatarCropper({
  imageUri,
  imageWidth,
  imageHeight,
  onCrop,
  onCancel,
}: AvatarCropperProps) {
  const viewport = useViewport();

  const { width: SCREEN_WIDTH } = viewport;
  const CIRCLE_SIZE = SCREEN_WIDTH * 0.7;
  const stylesLayout = {
    circleFrame: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
    },
  };

  const active = useScreenActive();
  const operation = useSessionOperation(active, imageUri);
  const cropping = operation.busy;
  const [error, setError] = useState<string | null>(null);
  // Calculate initial scale to fill the circle
  const aspectRatio = imageWidth / imageHeight;
  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // Cover the circle before zooming; fitting inside it leaves empty edges.
  const displayWidth =
    aspectRatio >= 1 ? CIRCLE_SIZE * aspectRatio : CIRCLE_SIZE;
  const displayHeight =
    aspectRatio >= 1 ? CIRCLE_SIZE : CIRCLE_SIZE / aspectRatio;
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      if (cropping) return;
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
      }
    });
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (cropping) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });
  const composed = Gesture.Simultaneous(pinchGesture, panGesture);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ]),
  }));
  const handleCrop = async () => {
    const task = operation.begin("crop-avatar");
    if (!task) return;
    setError(null);
    try {
      // Calculate crop region based on current transform
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;
      // The visible area in the circle corresponds to a region of the original image
      const scaledDisplayWidth = displayWidth * currentScale;
      const scaledDisplayHeight = displayHeight * currentScale;
      // Center of the circle in image coordinates
      const centerOffsetX =
        (scaledDisplayWidth - CIRCLE_SIZE) / 2 - currentTranslateX;
      const centerOffsetY =
        (scaledDisplayHeight - CIRCLE_SIZE) / 2 - currentTranslateY;
      // Convert to original image pixels
      const scaleToOriginalX = imageWidth / scaledDisplayWidth;
      const scaleToOriginalY = imageHeight / scaledDisplayHeight;
      const cropSize = Math.min(
        imageWidth,
        imageHeight,
        Math.round(CIRCLE_SIZE * scaleToOriginalX),
      );
      const cropX = Math.max(
        0,
        Math.min(
          Math.round(centerOffsetX * scaleToOriginalX),
          imageWidth - cropSize,
        ),
      );
      const cropY = Math.max(
        0,
        Math.min(
          Math.round(centerOffsetY * scaleToOriginalY),
          imageHeight - cropSize,
        ),
      );
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropSize,
              height: cropSize,
            },
          },
          { resize: { width: 400, height: 400 } },
        ],
        {
          // Keep the crop lossless; the server performs the final WebP encode.
          format: ImageManipulator.SaveFormat.PNG,
          signal: task.signal,
        },
      );
      task.assertCurrent();
      onCrop(manipResult.uri);
    } catch {
      if (task.isCurrent())
        setError(
          "Не удалось обрезать фото. Выбранное изображение сохранено — попробуйте ещё раз или выберите другое.",
        );
    } finally {
      task.finish();
    }
  };
  return (
    <div className={["ui-stack ", classes.container].filter(Boolean).join(" ")}>
      <Typography className={classes.title}>Выбери область</Typography>
      <Typography className={classes.hint}>
        Двигай и масштабируй фото
      </Typography>

      {/* Crop area */}
      <div
        className={["ui-stack ", classes.cropContainer]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Dark overlay with circular cutout */}
        <div
          style={{
            width: stylesLayout.circleFrame.width,
            height: stylesLayout.circleFrame.height,
            borderRadius: stylesLayout.circleFrame.borderRadius,
          }}
          className={["ui-stack ", classes.circleFrame]
            .filter(Boolean)
            .join(" ")}
        >
          <GestureDetector gesture={composed}>
            <Animated.div style={animatedStyle} className={classes.div}>
              <Picture
                source={{ uri: imageUri }}
                style={{ width: displayWidth, height: displayHeight }}
                contentFit="contain"
              />
            </Animated.div>
          </GestureDetector>
        </div>
      </div>

      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}

      {/* Buttons */}
      <div
        className={["ui-stack ", classes.buttonRow].filter(Boolean).join(" ")}
      >
        <Action
          onClick={() => {
            operation.cancel();
            onCancel();
          }}
          className={({ pressed }) =>
            [classes.action, pressed ? classes.opacityState : ""]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Typography className={classes.cancelButtonText}>Отмена</Typography>
        </Action>
        <Action
          onClick={handleCrop}
          disabled={cropping}
          aria-busy={cropping}
          className={({ pressed }) =>
            [
              classes.action2,
              pressed ? classes.transformState : "",
              cropping
                ? classes.opacityState2
                : pressed
                  ? classes.opacityState3
                  : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Typography className={classes.confirmButtonText}>
            {cropping ? "..." : "Готово"}
          </Typography>
        </Action>
      </div>
    </div>
  );
}
