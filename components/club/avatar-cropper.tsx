import { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";

// ─── Constants ──────────────────────────────────────────────────────────────

const BROWN = "#5C4033";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CIRCLE_SIZE = SCREEN_WIDTH * 0.7;

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
  const [cropping, setCropping] = useState(false);

  // Calculate initial scale to fill the circle
  const aspectRatio = imageWidth / imageHeight;
  const initialScale =
    aspectRatio > 1
      ? CIRCLE_SIZE / (CIRCLE_SIZE / aspectRatio)
      : CIRCLE_SIZE / (CIRCLE_SIZE * aspectRatio);

  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Image display size (fill circle width or height depending on aspect)
  const displayWidth = aspectRatio >= 1 ? CIRCLE_SIZE : CIRCLE_SIZE * aspectRatio;
  const displayHeight = aspectRatio >= 1 ? CIRCLE_SIZE / aspectRatio : CIRCLE_SIZE;

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
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
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleCrop = async () => {
    setCropping(true);
    try {
      // Calculate crop region based on current transform
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;

      // The visible area in the circle corresponds to a region of the original image
      const scaledDisplayWidth = displayWidth * currentScale;
      const scaledDisplayHeight = displayHeight * currentScale;

      // Center of the circle in image coordinates
      const centerOffsetX = (scaledDisplayWidth - CIRCLE_SIZE) / 2 - currentTranslateX;
      const centerOffsetY = (scaledDisplayHeight - CIRCLE_SIZE) / 2 - currentTranslateY;

      // Convert to original image pixels
      const scaleToOriginalX = imageWidth / scaledDisplayWidth;
      const scaleToOriginalY = imageHeight / scaledDisplayHeight;

      const cropX = Math.max(0, Math.round(centerOffsetX * scaleToOriginalX));
      const cropY = Math.max(0, Math.round(centerOffsetY * scaleToOriginalY));
      const cropSize = Math.round(CIRCLE_SIZE * scaleToOriginalX);

      // Ensure crop doesn't exceed image bounds
      const safeCropX = Math.min(cropX, imageWidth - cropSize);
      const safeCropY = Math.min(cropY, imageHeight - cropSize);
      const safeCropSize = Math.min(cropSize, imageWidth - safeCropX, imageHeight - safeCropY);

      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.max(0, safeCropX),
              originY: Math.max(0, safeCropY),
              width: Math.max(100, safeCropSize),
              height: Math.max(100, safeCropSize),
            },
          },
          { resize: { width: 400, height: 400 } },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCrop(manipResult.uri);
    } catch (error) {
      console.error("[AvatarCropper] Crop error:", error);
      // Fallback: just use the original image
      onCrop(imageUri);
    } finally {
      setCropping(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Выбери область</Text>
      <Text style={styles.hint}>Двигай и масштабируй фото</Text>

      {/* Crop area */}
      <View style={styles.cropContainer}>
        {/* Dark overlay with circular cutout */}
        <View style={styles.circleFrame}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imageContainer, animatedStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: displayWidth,
                  height: displayHeight,
                }}
                contentFit="contain"
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Отмена</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            cropping && { opacity: 0.5 },
          ]}
          onPress={handleCrop}
          disabled={cropping}
        >
          <Text style={styles.confirmButtonText}>
            {cropping ? "..." : "Готово"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: "Gogol-Regular",
    fontSize: 24,
    color: BROWN,
    marginBottom: 4,
  },
  hint: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: "#8B7355",
    marginBottom: 24,
  },
  cropContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  circleFrame: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(139,115,85,0.3)",
    backgroundColor: "#E8E0D6",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
  },
  cancelButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.3)",
  },
  cancelButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
  },
  confirmButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: OLIVE,
  },
  confirmButtonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 16,
    color: CREAM,
  },
});
