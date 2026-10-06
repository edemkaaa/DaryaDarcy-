"use client";
import { useViewport } from "@/shared/browser/viewport";

import classes from "./photo-editor.module.scss";
import tileStyles from "./photo-editor-tiles.module.scss";
import { mergeStyles, cssTransform } from "@/shared/ui/css";
import {
  ScrollArea,
  MeasuredBox,
  Typography,
  Action,
} from "@/shared/ui/elements";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type DragEvent,
} from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { Gesture, GestureDetector } from "@/shared/browser/gestures";
import { runOnJS } from "@/shared/browser/motion";
import { GAP, LONG_PRESS_MS } from "./photo-editor.content";
type TileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
const webBlockImageMenu = {
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.nativeEvent?.preventDefault?.();
    return false;
  },
  onDragStart: (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault?.();
  },
};
interface PhotoEditorProps {
  photos: string[];
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "left" | "right") => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onReplace?: (index: number) => void;
}
export function PhotoEditor({
  photos,
  onRemove,
  onMove,
  onReorder,
  onReplace,
}: PhotoEditorProps) {
  const viewport = useViewport();

  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tileLayouts = useRef<TileRect[]>([]);
  const dragFromRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const width = Math.min(viewport.width - 40, 640);
  const useCarousel = photos.length > 10;
  const canDragReorder = Boolean(onReorder) && photos.length > 1;
  useEffect(() => {
    if (!canDragReorder) return;
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
      const rect = tileRefs.current[index]?.getBoundingClientRect();
      if (rect)
        tileLayouts.current[index] = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
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
    },
    [measureAllTiles],
  );
  const updateDragPosition = useCallback(
    (
      translationX: number,
      translationY: number,
      pageX: number,
      pageY: number,
    ) => {
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
          runOnJS(updateDragPosition)(
            event.translationX,
            event.translationY,
            event.absoluteX,
            event.absoluteY,
          );
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
    imageClassName: string,
    surfaceClassName?: string,
    imageWidth?: number,
  ) => {
    const image = (
      <Picture
        source={{ uri }}
        contentFit="cover"
        className={[imageClassName, classes.picture].filter(Boolean).join(" ")}
        {...({ draggable: false, ...webBlockImageMenu } as object)}
        style={{ width: imageWidth ? imageWidth : undefined }}
      />
    );
    if (!canDragReorder) return image;
    return (
      <GestureDetector gesture={makeDragGesture(index)}>
        <div
          {...({ "data-photo-drag": "1" } as object)}
          {...(webBlockImageMenu as object)}
          className={[
            ["ui-stack", surfaceClassName].filter(Boolean).join(" "),
            classes.div,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {image}
        </div>
      </GestureDetector>
    );
  };
  const tileClassName = (index: number) =>
    [
      dragging && dragFrom === index ? tileStyles.dragging : "",
      dragging && overIndex === index && dragFrom !== index
        ? tileStyles.dropTarget
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  const tileChrome = (index: number) => {
    const isSource = dragging && dragFrom === index;
    return [
      isSource
        ? [
            {
              transform: cssTransform([
                { translateX: dragOffset.x },
                { translateY: dragOffset.y },
                { scale: 1.04 },
              ]),
              zIndex: 20,
            },
          ]
        : null,
    ];
  };
  const renderThumbStrip = () => (
    <ScrollArea horizontal hideScrollbar className={classes.thumbStrip}>
      {photos.map((uri, i) => (
        <MeasuredBox
          key={`${uri}-${i}`}
          ref={(node) => {
            tileRefs.current[i] = node;
          }}
          onResize={measureAllTiles}
          className={[tileClassName(i), classes.measuredBox]
            .filter(Boolean)
            .join(" ")}
          style={mergeStyles(tileChrome(i))}
        >
          {renderDraggableImage(
            uri,
            i,
            tileStyles.thumbImage,
            tileStyles.thumbSurface,
          )}
          {!canDragReorder ? (
            <Typography className={classes.thumbIndex}>{i + 1}</Typography>
          ) : null}
        </MeasuredBox>
      ))}
    </ScrollArea>
  );
  if (useCarousel) {
    return (
      <div className="ui-stack ">
        <ScrollArea horizontal paging className={classes.thumbStrip}>
          {photos.map((uri, i) => (
            <div
              key={`${uri}-${i}`}
              style={{ width: width }}
              className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
            >
              <MeasuredBox
                ref={(node) => {
                  tileRefs.current[i] = node;
                }}
                onResize={measureAllTiles}
                className={[tileClassName(i), classes.measuredBox2]
                  .filter(Boolean)
                  .join(" ")}
                style={mergeStyles({ width: width }, tileChrome(i))}
              >
                {renderDraggableImage(
                  uri,
                  i,
                  tileStyles.carouselImage,
                  tileStyles.carouselSurface,
                  width,
                )}
              </MeasuredBox>
              <PhotoControls
                index={i}
                total={photos.length}
                onRemove={onRemove}
                onMove={onMove}
                onReplace={onReplace}
                hideReorder={canDragReorder}
                hideIndex={canDragReorder}
              />
            </div>
          ))}
        </ScrollArea>
        {canDragReorder ? (
          <>
            {renderThumbStrip()}
            <Typography className={classes.dragHint}>
              Удерживайте миниатюру и перетащите, чтобы изменить порядок
            </Typography>
          </>
        ) : null}
      </div>
    );
  }
  const cols = photos.length === 1 ? 1 : photos.length === 2 ? 2 : 3;
  const tile = (width - GAP * (cols - 1)) / cols;
  return (
    <div
      {...(canDragReorder ? ({ "data-photo-drag": "1" } as object) : null)}
      className="ui-stack "
    >
      <div
        style={{ width: width }}
        className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
      >
        {photos.map((uri, i) => (
          <MeasuredBox
            key={`${uri}-${i}`}
            ref={(node) => {
              tileRefs.current[i] = node;
            }}
            onResize={measureAllTiles}
            className={[tileClassName(i), classes.measuredBox3]
              .filter(Boolean)
              .join(" ")}
            style={mergeStyles(
              {
                width: tile,
                height: tile,
                ...((canDragReorder ? true : false)
                  ? {
                      cursor: canDragReorder
                        ? dragging && dragFrom === i
                          ? "grabbing"
                          : "grab"
                        : undefined,
                    }
                  : {}),
              },
              tileChrome(i),
            )}
          >
            {renderDraggableImage(uri, i, tileStyles.gridImage)}
            <PhotoControls
              index={i}
              total={photos.length}
              onRemove={onRemove}
              onMove={onMove}
              onReplace={onReplace}
              hideReorder={canDragReorder}
              hideIndex={canDragReorder}
            />
          </MeasuredBox>
        ))}
      </div>
      {canDragReorder ? (
        <Typography className={classes.dragHint}>
          Удерживайте фото и перетащите, чтобы изменить порядок
        </Typography>
      ) : null}
    </div>
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
      <Action
        aria-label={`Удалить фото ${index + 1}`}
        onClick={() => onRemove(index)}
        className={classes.removeBtn}
      >
        <MaterialIcons name="close" size={12} color="#fff" />
      </Action>
      {hideIndex ? null : (
        <div
          className={["ui-stack ", classes.indexBadge]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.indexText}>{index + 1}</Typography>
        </div>
      )}
      {hideReorder ? null : (
        <div
          className={["ui-stack ", classes.reorderRow]
            .filter(Boolean)
            .join(" ")}
        >
          {index > 0 ? (
            <Action
              aria-label={`Переместить фото ${index + 1} влево`}
              onClick={() => onMove(index, "left")}
              className={classes.reorderBtn}
            >
              <MaterialIcons name="chevron-left" size={12} color="#fff" />
            </Action>
          ) : null}
          {index < total - 1 ? (
            <Action
              aria-label={`Переместить фото ${index + 1} вправо`}
              onClick={() => onMove(index, "right")}
              className={classes.reorderBtn}
            >
              <MaterialIcons name="chevron-right" size={12} color="#fff" />
            </Action>
          ) : null}
        </div>
      )}
      {onReplace ? (
        <Action
          aria-label={`Заменить фото ${index + 1}`}
          onClick={() => onReplace(index)}
          className={classes.replaceBtn}
        >
          <MaterialIcons name="swap-horiz" size={12} color="#fff" />
        </Action>
      ) : null}
    </>
  );
}
