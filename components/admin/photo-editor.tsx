import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const GAP = 8;
const LONG_PRESS_MS = 300;

type TileRect = { x: number; y: number; width: number; height: number };

const WEB_NO_CALLOUT =
  Platform.OS === "web"
    ? ({
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "none",
      } as object)
    : null;

const webBlockImageMenu =
  Platform.OS === "web"
    ? {
        onContextMenu: (event: any) => {
          event.preventDefault?.();
          event.stopPropagation?.();
          event.nativeEvent?.preventDefault?.();
          return false;
        },
        onDragStart: (event: any) => {
          event.preventDefault?.();
        },
      }
    : null;

interface PhotoEditorProps {
  photos: string[];
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "left" | "right") => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onReplace?: (index: number) => void;
}

export function PhotoEditor({ photos, onRemove, onMove, onReorder, onReplace }: PhotoEditorProps) {
  const tileRefs = useRef<(View | null)[]>([]);
  const tileLayouts = useRef<TileRect[]>([]);
  const dragFromRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const width = Math.min(Dimensions.get("window").width - 40, 640);
  const useCarousel = photos.length > 10;
  const canDragReorder = Boolean(onReorder) && photos.length > 1;

  useEffect(() => {
    if (Platform.OS !== "web" || !canDragReorder) return;
    const blockMenu = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-photo-drag]")) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", blockMenu, true);
    return () => document.removeEventListener("contextmenu", blockMenu, true);
  }, [canDragReorder]);

  const measureAllTiles = useCallback(() => {
    photos.forEach((_, index) => {
      tileRefs.current[index]?.measureInWindow((x, y, w, h) => {
        tileLayouts.current[index] = { x, y, width: w, height: h };
      });
    });
  }, [photos]);

  const findIndexAtPoint = useCallback(
    (pageX: number, pageY: number) => {
      for (let i = 0; i < photos.length; i++) {
        const rect = tileLayouts.current[i];
        if (!rect) continue;
        if (
          pageX >= rect.x &&
          pageX <= rect.x + rect.width &&
          pageY >= rect.y &&
          pageY <= rect.y + rect.height
        ) {
          return i;
        }
      }
      return null;
    },
    [photos.length],
  );

  const resetDrag = useCallback(() => {
    dragFromRef.current = null;
    overIndexRef.current = null;
    setDragFrom(null);
    setOverIndex(null);
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const startDrag = useCallback(
    (index: number) => {
      measureAllTiles();
      dragFromRef.current = index;
      overIndexRef.current = index;
      setDragFrom(index);
      setOverIndex(index);
      setDragging(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [measureAllTiles],
  );

  const updateDragPosition = useCallback(
    (translationX: number, translationY: number, pageX: number, pageY: number) => {
      setDragOffset({ x: translationX, y: translationY });
      const next = findIndexAtPoint(pageX, pageY);
      if (next != null) {
        overIndexRef.current = next;
        setOverIndex((prev) => (prev === next ? prev : next));
      }
    },
    [findIndexAtPoint],
  );

  const finishDrag = useCallback(() => {
    const from = dragFromRef.current;
    const to = overIndexRef.current;
    if (from != null && to != null && from !== to && onReorder) {
      onReorder(from, to);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    resetDrag();
  }, [onReorder, resetDrag]);

  const makeDragGesture = useCallback(
    (index: number) =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .onStart(() => {
          runOnJS(startDrag)(index);
        })
        .onUpdate((event) => {
          runOnJS(updateDragPosition)(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
        })
        .onEnd(() => {
          runOnJS(finishDrag)();
        }),
    [finishDrag, startDrag, updateDragPosition],
  );

  if (photos.length === 0) return null;

  const renderDraggableImage = (
    uri: string,
    index: number,
    imageStyle: object,
    surfaceStyle?: object,
  ) => {
    const image = (
      <Image
        source={{ uri }}
        style={[imageStyle, WEB_NO_CALLOUT]}
        contentFit="cover"
        pointerEvents="none"
        {...(Platform.OS === "web" ? ({ draggable: false, ...webBlockImageMenu } as object) : null)}
      />
    );

    if (!canDragReorder) return image;

    return (
      <GestureDetector gesture={makeDragGesture(index)}>
        <View
          {...(Platform.OS === "web" ? ({ "data-photo-drag": "1" } as object) : null)}
          style={[styles.dragSurface, surfaceStyle, WEB_NO_CALLOUT]}
          {...(webBlockImageMenu as object)}
        >
          {image}
        </View>
      </GestureDetector>
    );
  };

  const tileChrome = (index: number) => {
    const isSource = dragging && dragFrom === index;
    const isTarget = dragging && overIndex === index && dragFrom !== index;
    return [
      isSource
        ? [
            styles.draggingTile,
            {
              transform: [
                { translateX: dragOffset.x },
                { translateY: dragOffset.y },
                { scale: 1.04 },
              ],
              zIndex: 20,
            },
          ]
        : null,
      isTarget ? styles.dropTarget : null,
    ];
  };

  const renderThumbStrip = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
      {photos.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          ref={(node) => {
            tileRefs.current[i] = node;
          }}
          onLayout={measureAllTiles}
          style={[styles.thumb, ...tileChrome(i)]}
        >
          {renderDraggableImage(uri, i, styles.thumbImage, styles.thumbDragSurface)}
          {!canDragReorder ? <Text style={styles.thumbIndex}>{i + 1}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );

  if (useCarousel) {
    return (
      <View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator style={styles.carousel}>
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={[styles.carouselSlide, { width }]}>
              <View
                ref={(node) => {
                  tileRefs.current[i] = node;
                }}
                onLayout={measureAllTiles}
                style={[{ width, height: 240 }, ...tileChrome(i)]}
              >
                {renderDraggableImage(uri, i, [styles.carouselImage, { width }], styles.carouselDragSurface)}
              </View>
              <PhotoControls
                index={i}
                total={photos.length}
                onRemove={onRemove}
                onMove={onMove}
                onReplace={onReplace}
                hideReorder={canDragReorder}
                hideIndex={canDragReorder}
              />
            </View>
          ))}
        </ScrollView>
        {canDragReorder ? (
          <>
            {renderThumbStrip()}
            <Text style={styles.dragHint}>Удерживайте миниатюру и перетащите, чтобы изменить порядок</Text>
          </>
        ) : null}
      </View>
    );
  }

  const cols = photos.length === 1 ? 1 : photos.length === 2 ? 2 : 3;
  const tile = (width - GAP * (cols - 1)) / cols;

  return (
    <View {...(Platform.OS === "web" && canDragReorder ? ({ "data-photo-drag": "1" } as object) : null)}>
      <View style={[styles.grid, { width }, WEB_NO_CALLOUT]}>
        {photos.map((uri, i) => (
          <View
            key={`${uri}-${i}`}
            ref={(node) => {
              tileRefs.current[i] = node;
            }}
            onLayout={measureAllTiles}
            style={[
              { width: tile, height: tile, position: "relative" },
              canDragReorder ? ({ cursor: dragging && dragFrom === i ? "grabbing" : "grab" } as object) : null,
              ...tileChrome(i),
            ]}
          >
            {renderDraggableImage(uri, i, styles.gridImage)}
            <PhotoControls
              index={i}
              total={photos.length}
              onRemove={onRemove}
              onMove={onMove}
              onReplace={onReplace}
              hideReorder={canDragReorder}
              hideIndex={canDragReorder}
            />
          </View>
        ))}
      </View>
      {canDragReorder ? (
        <Text style={styles.dragHint}>Удерживайте фото и перетащите, чтобы изменить порядок</Text>
      ) : null}
    </View>
  );
}

function PhotoControls({
  index,
  total,
  onRemove,
  onMove,
  onReplace,
  hideReorder = false,
  hideIndex = false,
}: {
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "left" | "right") => void;
  onReplace?: (index: number) => void;
  hideReorder?: boolean;
  hideIndex?: boolean;
}) {
  return (
    <>
      <Pressable onPress={() => onRemove(index)} style={styles.removeBtn}>
        <MaterialIcons name="close" size={12} color="#fff" />
      </Pressable>
      {hideIndex ? null : (
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
      )}
      {hideReorder ? null : (
        <View style={styles.reorderRow}>
          {index > 0 ? (
            <Pressable onPress={() => onMove(index, "left")} style={styles.reorderBtn}>
              <MaterialIcons name="chevron-left" size={12} color="#fff" />
            </Pressable>
          ) : null}
          {index < total - 1 ? (
            <Pressable onPress={() => onMove(index, "right")} style={styles.reorderBtn}>
              <MaterialIcons name="chevron-right" size={12} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      )}
      {onReplace ? (
        <Pressable onPress={() => onReplace(index)} style={styles.replaceBtn}>
          <MaterialIcons name="swap-horiz" size={12} color="#fff" />
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    marginTop: 10,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#EEE9E0",
  },
  dragSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    overflow: "hidden",
    ...(WEB_NO_CALLOUT ?? {}),
  },
  thumbDragSurface: {
    width: "100%",
    height: "100%",
  },
  carouselDragSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  draggingTile: {
    opacity: 0.62,
    shadowColor: "#4A3728",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 24px rgba(74,55,40,0.28)" } as object)
      : null),
  },
  dropTarget: {
    borderWidth: 2,
    borderColor: "#8FA87A",
  },
  dragHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#8B7355",
    fontFamily: "EBGaramond-Italic",
  },
  carousel: { marginTop: 10 },
  carouselSlide: {
    height: 240,
    marginRight: 0,
    position: "relative",
  },
  carouselImage: {
    height: 240,
    borderRadius: 10,
    backgroundColor: "#EEE9E0",
  },
  thumbStrip: {
    marginTop: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 8,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbIndex: {
    position: "absolute",
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#A85C5C",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  replaceBtn: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(74,55,40,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  indexBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  indexText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  reorderRow: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    gap: 4,
    zIndex: 2,
  },
  reorderBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
});
