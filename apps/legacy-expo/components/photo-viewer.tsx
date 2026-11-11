// Архив Expo. Монтирует viewer только с непустыми фото и сбрасывает внутреннюю сцену по ключу набора.
import { useState, useCallback, useRef, useLayoutEffect } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface PhotoViewerProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function PhotoViewer({ visible, photos, initialIndex = 0, onClose }: PhotoViewerProps) {
  // Монтирует viewer только с непустыми фото и сбрасывает внутреннюю сцену по ключу набора.

  if (!visible || photos.length === 0) return null;
  return (
    <PhotoViewerInner
      key={`${initialIndex}-${photos.length}-${photos[0] ?? ""}`}
      photos={photos}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
}

function PhotoViewerInner({ photos, initialIndex = 0, onClose }: Omit<PhotoViewerProps, "visible">) {
  // Показывает постраничную галерею с SafeArea, счётчиком и вертикальным жестом закрытия.

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const scrollRef = useRef<ScrollView>(null);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const handleClose = useCallback(() => {
    // Уведомляет владельца и сбрасывает shared values для следующего открытия.

    onClose();
    translateY.value = 0;
    opacity.value = 1;
  }, [onClose, opacity, translateY]);

  useLayoutEffect(() => {
    // После layout и смены размеров повторно выставляет начальный offset; cleanup снимает платформенный таймер.

    setCurrentIndex(safeInitialIndex);
    const offset = safeInitialIndex * screenWidth;
    scrollRef.current?.scrollTo({ x: offset, y: 0, animated: false });
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: offset, y: 0, animated: false });
    }, Platform.OS === "web" ? 0 : 50);
    return () => clearTimeout(timer);
  }, [safeInitialIndex, screenWidth, photos]);

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
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const updateIndexFromOffset = useCallback(
    (offsetX: number) => {
      // Округляет смещение до допустимого индекса фотографии.

      const index = Math.round(offsetX / screenWidth);
      if (index >= 0 && index < photos.length) setCurrentIndex(index);
    },
    [photos.length, screenWidth],
  );

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Согласует текущий индекс после инерционного либо ручного завершения листания.

      updateIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [updateIndexFromOffset],
  );

  const imageHeight = screenHeight * 0.8;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[viewerStyles.backdrop, animatedBgStyle]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[viewerStyles.container, animatedContainerStyle]}>
          <Pressable
            onPress={handleClose}
            style={[viewerStyles.closeButton, { top: insets.top + 10 }]}
          >
            <MaterialIcons name="close" size={26} color="#fff" />
          </Pressable>

          {photos.length > 1 && (
            <View style={[viewerStyles.counter, { top: insets.top + 14 }]}>
              <Text style={viewerStyles.counterText}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={photos.length > 1}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={screenWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            scrollEventThrottle={16}
            style={viewerStyles.scroll}
            contentContainerStyle={{ width: screenWidth * photos.length }}
          >
            {photos.map((uri, index) => (
              <View
                key={`${index}-${uri}`}
                style={[viewerStyles.slide, { width: screenWidth, height: screenHeight }]}
              >
                <Image
                  source={{ uri }}
                  style={{ width: screenWidth, height: imageHeight }}
                  contentFit="contain"
                  transition={150}
                />
              </View>
            ))}
          </ScrollView>

          {photos.length > 1 && photos.length <= 10 && (
            <View style={[viewerStyles.dotsRow, { bottom: insets.bottom + 30 }]}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    viewerStyles.dot,
                    i === currentIndex && viewerStyles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  counter: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
  },
  dotsRow: {
    position: "absolute",
    flexDirection: "row",
    alignSelf: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
