"use client";
/** Полноэкранный просмотр владеет индексом и жестами, освобождая временные состояния при закрытии. */
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
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
import { isPublicFeedPhoto } from "@/shared/ui/static-images";
import { PhotoDots } from "./photo-dots";
import {
  scrollPhotoTo,
  scrollPhotoWithKeyboard,
} from "./photo-carousel-navigation";
import { PhotoNavigation } from "./photo-navigation";
import { usePhotoMouseDrag } from "./use-photo-mouse-drag";
import { MaterialIcons } from "@/shared/ui/icons";
import { Spinner } from "@/shared/ui/spinner";
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
/** Удерживаем исходную карточку пока открыт просмотр; при закрытии внутренний экземпляр со всеми жестами размонтируется. */
export function PhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
}: PhotoViewerProps) {
  useCollectionItemRetention(visible);
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
/** Полноэкранный диалог использует размеры окна, а не 480px-полотна; индекс объединяет scroll, клавиатуру и кнопки. */
function PhotoViewerInner({
  photos,
  initialIndex = 0,
  onClose,
}: Omit<PhotoViewerProps, "visible">) {
  // The dialog lives outside the 480px app frame and fills the browser window.
  const { width: screenWidth, height: screenHeight } = useViewport("screen");
  const insets = useSafeAreaInsets();
  const imageHeight = screenHeight * 0.8;
  const safeInitialIndex = Math.min(
    Math.max(initialIndex, 0),
    Math.max(photos.length - 1, 0),
  );
  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mouseDrag = usePhotoMouseDrag(screenWidth, photos.length);
  const currentIndexRef = useRef(safeInitialIndex);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const zoom = useSharedValue(1);
  const savedZoom = useSharedValue(1);
  const zoomX = useSharedValue(0);
  const zoomY = useSharedValue(0);
  const savedZoomX = useSharedValue(0);
  const savedZoomY = useSharedValue(0);
  const touch = useRef({
    left: 0,
    snap: "",
    axis: null as "x" | "y" | "cancelled" | null,
  });
  // Масштаб принадлежит одному кадру: смена фото и размеров окна возвращает исходный вид.
  const resetZoom = useCallback(() => {
    zoom.value = savedZoom.value = 1;
    zoomX.value = zoomY.value = savedZoomX.value = savedZoomY.value = 0;
  }, [zoom, savedZoom, zoomX, zoomY, savedZoomX, savedZoomY]);
  useLayoutEffect(resetZoom, [currentIndex, resetZoom]);

  /** Сначала сообщаем владельцу о закрытии, затем сбрасываем общие значения анимации для следующего открытия. */
  const handleClose = useCallback(() => {
    onClose();
    translateY.value = 0;
    opacity.value = 1;
  }, [onClose, opacity, translateY]);
  useLayoutEffect(() => {
    // При повороте сохраняем кадр и пересчитываем его позицию до видимого обновления.
    resetZoom();
    const preservedIndex = Math.min(currentIndexRef.current, photos.length - 1);
    currentIndexRef.current = preservedIndex;
    setCurrentIndex(preservedIndex);
    const offset = preservedIndex * screenWidth;
    scrollRef.current?.scrollTo({ left: offset, top: 0, behavior: "instant" });
  }, [screenWidth, screenHeight, photos.length, resetZoom]);
  /** Незавершённое закрытие возвращает кадр и фон в исходное положение за одну короткую анимацию. */
  const resetPan = () => {
    translateY.value = withTiming(0, { duration: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  };
  // Ограничиваем сдвиг самим вписанным фото, а не его прямоугольником с пустыми полями.
  const setZoomPosition = (x: number, y: number) => {
    const image = scrollRef.current?.querySelector<HTMLImageElement>(
      '[data-photo-zoom="active"] img',
    );
    const fit =
      image?.naturalWidth && image.naturalHeight
        ? Math.min(
            screenWidth / image.naturalWidth,
            imageHeight / image.naturalHeight,
          )
        : 1;
    const width = image?.naturalWidth ? image.naturalWidth * fit : screenWidth;
    const height = image?.naturalHeight
      ? image.naturalHeight * fit
      : imageHeight;
    const limitX = Math.max(0, (width * zoom.value - screenWidth) / 2);
    const limitY = Math.max(0, (height * zoom.value - screenHeight) / 2);
    zoomX.value = Math.max(-limitX, Math.min(x, limitX));
    zoomY.value = Math.max(-limitY, Math.min(y, limitY));
  };
  const restoreSnap = () => {
    if (scrollRef.current)
      scrollRef.current.style.scrollSnapType = touch.current.snap;
  };
  // Один палец листает/закрывает исходный кадр либо перемещает уже увеличенный снимок.
  const panGesture = Gesture.Pan()
    .onStart(() => {
      const scroll = scrollRef.current;
      touch.current = {
        left: scroll?.scrollLeft ?? 0,
        snap: scroll?.style.scrollSnapType ?? "x mandatory",
        axis: null,
      };
      if (scroll) scroll.style.scrollSnapType = "none";
      savedZoomX.value = zoomX.value;
      savedZoomY.value = zoomY.value;
    })
    .onUpdate((e) => {
      if (zoom.value > 1) {
        setZoomPosition(
          savedZoomX.value + e.translationX,
          savedZoomY.value + e.translationY,
        );
        return;
      }
      const state = touch.current;
      if (!state.axis && Math.hypot(e.translationX, e.translationY) > 8)
        state.axis =
          Math.abs(e.translationX) > Math.abs(e.translationY) ? "x" : "y";
      if (state.axis === "x" && scrollRef.current) {
        scrollRef.current.scrollLeft = Math.max(
          0,
          Math.min(
            state.left - e.translationX,
            screenWidth * (photos.length - 1),
          ),
        );
      } else if (state.axis === "y") {
        if (Math.abs(e.translationX) > 24) {
          state.axis = "cancelled";
          resetPan();
          return;
        }
        const offset = Math.max(e.translationY, 0);
        translateY.value = offset;
        opacity.value = 1 - Math.min(offset / 400, 0.6);
      }
    })
    .onEnd((e) => {
      restoreSnap();
      if (zoom.value > 1) return;
      const state = touch.current;
      if (state.axis === "x") {
        const initial = Math.round(state.left / screenWidth);
        const nearest = Math.round(
          (scrollRef.current?.scrollLeft ?? state.left) / screenWidth,
        );
        const distance = -e.translationX;
        const target =
          Math.abs(distance) > Math.max(40, Math.min(screenWidth * 0.18, 120))
            ? nearest === initial
              ? initial + Math.sign(distance)
              : nearest
            : initial;
        scrollPhotoTo(scrollRef.current, screenWidth, photos.length, target);
      } else if (state.axis === "y" && e.translationY > 150) {
        translateY.value = withTiming(screenHeight, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () =>
          runOnJS(handleClose)(),
        );
      } else resetPan();
    })
    .onCancel(() => {
      restoreSnap();
      scrollPhotoTo(
        scrollRef.current,
        screenWidth,
        photos.length,
        Math.round(touch.current.left / screenWidth),
      );
      resetPan();
    });
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedZoom.value = zoom.value;
      resetPan();
    })
    .onUpdate((e) => {
      zoom.value = Math.max(1, Math.min(savedZoom.value * e.scale, 4));
      setZoomPosition(zoomX.value, zoomY.value);
    })
    .onEnd(() => {
      savedZoom.value = zoom.value;
    });
  const photoGesture = Gesture.Simultaneous(panGesture, pinchGesture);
  const zoomStyle = useAnimatedStyle(() => ({
    transform: cssTransform([
      { translateX: zoomX.value },
      { translateY: zoomY.value },
      { scale: zoom.value },
    ]),
  }));
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ translateY: translateY.value }]),
  }));
  const animatedBgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  const updateIndexFromOffset = useCallback(
    /** Принимаем только индекс существующего кадра, вычисленный по ширине текущего окна. */
    (offsetX: number) => {
      const index = Math.round(offsetX / screenWidth);
      if (index >= 0 && index < photos.length) {
        currentIndexRef.current = index;
        setCurrentIndex(index);
      }
    },
    [photos.length, screenWidth],
  );
  const onScroll = useCallback(
    /** Синхронизируем счётчик с фактической горизонтальной прокруткой, включая нативное листание. */
    (event: ScrollEvent) => {
      updateIndexFromOffset(event.currentTarget.scrollLeft);
    },
    [updateIndexFromOffset],
  );
  return (
    <Dialog
      label="Просмотр фотографий"
      open
      motion="fade"
      onClose={handleClose}
    >
      <Animated.div style={animatedBgStyle} className={classes.div} />
      <GestureDetector gesture={photoGesture} pointerTypes={["touch"]}>
        <Animated.div
          style={animatedContainerStyle}
          className={classes.div2}
          onKeyDown={(event) =>
            scrollPhotoWithKeyboard(
              event,
              screenWidth,
              photos.length,
              scrollRef.current,
            )
          }
        >
          <Action
            onClick={handleClose}
            aria-label="Закрыть фотографии"
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
            {...mouseDrag}
            mouseDrag={false}
            ref={scrollRef}
            horizontal
            paging
            hideScrollbar
            snapInterval={screenWidth}
            onScroll={onScroll}
            aria-label="Перелистывание фотографий"
            contentStyle={{ width: screenWidth * photos.length }}
            className={`${classes.scroll} ${mouseDrag.className}`}
          >
            {photos.map((uri, index) => (
              <div
                key={`${index}-${uri}`}
                style={{ width: screenWidth, height: screenHeight }}
                className={["ui-stack ", classes.div4]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Animated.div
                  data-photo-zoom={
                    index === currentIndex ? "active" : undefined
                  }
                  style={index === currentIndex ? zoomStyle : undefined}
                >
                  <Picture
                    source={
                      Math.abs(index - currentIndex) <= 1 ? { uri } : undefined
                    }
                    fullSize={!isPublicFeedPhoto(uri)}
                    sizes="100vw"
                    showRetryButton
                    loadingFallback={
                      <div className={classes.loading}>
                        <Spinner
                          size="large"
                          color="#eee"
                          label="Загрузка изображения…"
                        />
                      </div>
                    }
                    loading={index === currentIndex ? "eager" : "lazy"}
                    style={{ width: screenWidth, height: imageHeight }}
                    contentFit="contain"
                    transition={150}
                  />
                </Animated.div>
              </div>
            ))}
          </ScrollArea>

          <PhotoDots
            count={photos.length}
            index={currentIndex}
            style={{ bottom: insets.bottom + 30 }}
            className={classes.div5}
          />
          <PhotoNavigation
            count={photos.length}
            index={currentIndex}
            onNavigate={(next) =>
              scrollPhotoTo(scrollRef.current, screenWidth, photos.length, next)
            }
          />
        </Animated.div>
      </GestureDetector>
    </Dialog>
  );
}
