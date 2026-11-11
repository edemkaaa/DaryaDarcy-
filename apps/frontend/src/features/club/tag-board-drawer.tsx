"use client";
/** Панель тегов меняет фильтр клубного списка, сохраняя выбор рубрики отдельно от содержимого карточек. */
import { useViewport } from "@/shared/browser/viewport";

import { getTagBoardDrawerLayout } from "./tag-board-drawer.layout";
import classes from "./tag-board-drawer.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Action, ScrollArea, Typography } from "@/shared/ui/elements";
import { useEffect, useCallback, useId, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from "@/shared/browser/motion";
import { MaterialIcons } from "@/shared/ui/icons";
import { SEASON_TAGS } from "@/domain/post/post-tags";
import {
  BROWN,
  PEEK_STRIP_WIDTH,
  TAG_BOARD_URI,
  TOPIC_TAG_ROWS,
} from "./tag-board-drawer.content";
import { getTagBoardDrawerContent } from "./tag-board-drawer.content";
interface TagBoardDrawerProps {
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}
export function TagBoardDrawer({
  selectedTag,
  onSelectTag,
}: TagBoardDrawerProps) {
  const viewport = useViewport();
  const { stylesLayout } = getTagBoardDrawerLayout(viewport);
  const { DRAWER_WIDTH } = getTagBoardDrawerContent(viewport);
  const [isOpen, setIsOpen] = useState(false);
  const drawerId = useId();
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // translateX: 0 = fully open (drawer visible), DRAWER_WIDTH = fully closed (hidden off-screen right)
  const translateX = useSharedValue(DRAWER_WIDTH);
  // Extend the edge strip while keeping its right edge anchored.
  const peekAnim = useSharedValue(0);
  // Start peek animation loop (only when drawer is closed)
  const startPeekAnimation = useCallback(() => {
    peekAnim.value = withDelay(
      2000,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 180, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) }),
          withDelay(4500, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, [peekAnim]);
  const stopPeekAnimation = useCallback(() => {
    peekAnim.value = withTiming(0, { duration: 100 });
  }, [peekAnim]);
  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => {
    returnFocus.current = true;
    setIsOpen(false);
  };
  useEffect(() => {
    translateX.value = withTiming(isOpen ? 0 : DRAWER_WIDTH, {
      duration: isOpen ? 300 : 280,
      easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
    if (isOpen) {
      stopPeekAnimation();
      return;
    }
    // Cancel a pending restart when reopened or unmounted.
    const timer = setTimeout(
      startPeekAnimation,
      returnFocus.current ? 1500 : 0,
    );
    return () => clearTimeout(timer);
  }, [isOpen, DRAWER_WIDTH, translateX, startPeekAnimation, stopPeekAnimation]);
  useEffect(() => {
    if (isOpen) closeButton.current?.focus({ preventScroll: true });
    else if (returnFocus.current) {
      openButton.current?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [isOpen]);
  // Animated styles
  const drawerStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ translateX: translateX.value }]),
  }));
  const peekStyle = useAnimatedStyle(() => {
    const drawerClosed = translateX.value >= DRAWER_WIDTH - 1;
    return {
      width: PEEK_STRIP_WIDTH - (drawerClosed ? peekAnim.value : 0),
      opacity: interpolate(
        translateX.value,
        [DRAWER_WIDTH * 0.5, DRAWER_WIDTH],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });
  const handleTagPress = (tag: string) => {
    if (selectedTag === tag) {
      onSelectTag(null); // deselect
    } else {
      onSelectTag(tag);
    }
  };
  return (
    <>
      {/* Peek strip — extends from the right edge, tap to open */}
      <Animated.div
        inert={isOpen}
        aria-hidden={isOpen}
        style={[{ top: stylesLayout.peekStrip.top }, peekStyle]}
        className={classes.div}
      >
        <Action
          ref={openButton}
          onClick={openDrawer}
          aria-label="Открыть фильтры клуба"
          aria-expanded={isOpen}
          aria-controls={drawerId}
          className={({ pressed }) =>
            [classes.action, pressed ? classes.opacityState : ""]
              .filter(Boolean)
              .join(" ")
          }
        >
          <div
            style={{ width: PEEK_STRIP_WIDTH }}
            className={["ui-stack ", classes.peekHandle]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.peekLine]
                .filter(Boolean)
                .join(" ")}
            />
            <div
              className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
            />
          </div>
        </Action>
      </Animated.div>

      {/* Main Drawer */}
      <Animated.div
        id={drawerId}
        role="region"
        aria-label="Фильтры клуба"
        data-scroll-header="ignore"
        aria-hidden={!isOpen}
        inert={!isOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeDrawer();
          }
        }}
        style={[
          { top: stylesLayout.drawer.top, width: stylesLayout.drawer.width },
          drawerStyle,
        ]}
        className={classes.div3}
      >
        <div
          style={{
            left: stylesLayout.boardFrame.left,
            width: stylesLayout.boardFrame.width,
            height: stylesLayout.boardFrame.height,
          }}
          className={["ui-stack ", classes.boardFrame]
            .filter(Boolean)
            .join(" ")}
        >
          <Picture
            source={{ uri: TAG_BOARD_URI }}
            style={{
              width: stylesLayout.boardImage.width,
              height: stylesLayout.boardImage.height,
            }}
            contentFit="contain"
            contentPosition="top"
          />

          {/* Close button — top right of board */}
          <Action
            ref={closeButton}
            onClick={closeDrawer}
            aria-label="Закрыть фильтры клуба"
            className={({ pressed }) =>
              [
                classes.action2,
                pressed ? classes.opacityState2 : "",
                pressed ? classes.transformState : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <MaterialIcons name="close" size={20} color={BROWN} />
          </Action>

          {/* Content on top of board */}
          <ScrollArea
            hideScrollbar
            tabIndex={-1}
            role="group"
            aria-label="Сезоны и темы"
            style={{
              top: stylesLayout.drawerContent.top,
              left: 0,
              right: 0,
              height: stylesLayout.drawerContent.height,
              maxHeight: `calc(100% - ${stylesLayout.drawerContent.top}px)`,
              paddingTop: stylesLayout.drawerContent.paddingTop,
            }}
            contentStyle={{
              width: "100%",
              paddingLeft: stylesLayout.drawerContent.left,
              paddingRight: stylesLayout.drawerContent.right,
            }}
            className={["ui-stack ", classes.drawerContent]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.tagBoardInner]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Season tags */}
              <div
                className={["ui-stack ", classes.tagSection]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={["ui-stack ", classes.tagRow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {SEASON_TAGS.map((tag) => (
                    <Action
                      key={tag.slug}
                      aria-pressed={selectedTag === tag.slug}
                      onClick={() => handleTagPress(tag.slug)}
                      className={({ pressed }) =>
                        [
                          classes.action3,
                          pressed ? classes.opacityState3 : "",
                          pressed ? classes.transformState2 : "",
                          selectedTag === tag.slug
                            ? classes.appearanceState
                            : classes.appearanceState2,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      <Typography
                        className={[
                          classes.tagChipTextActive,
                          selectedTag === tag.slug
                            ? classes.colorState
                            : classes.colorState2,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {tag.label}
                      </Typography>
                    </Action>
                  ))}
                </div>
              </div>

              {/* Category tags — fixed rows aligned to the board */}
              <div
                className={["ui-stack ", classes.tagSection]
                  .filter(Boolean)
                  .join(" ")}
              >
                {TOPIC_TAG_ROWS.map((row, rowIndex) => (
                  <div
                    key={`topic-row-${rowIndex}`}
                    className={["ui-stack ", classes.tagRow]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.map((tag) => (
                      <Action
                        key={tag.slug}
                        aria-pressed={selectedTag === tag.slug}
                        onClick={() => handleTagPress(tag.slug)}
                        className={({ pressed }) =>
                          [
                            classes.action3,
                            pressed ? classes.opacityState4 : "",
                            pressed ? classes.transformState3 : "",
                            selectedTag === tag.slug
                              ? classes.appearanceState3
                              : classes.appearanceState4,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        }
                      >
                        <Typography
                          className={[
                            classes.tagChipTextActive,
                            selectedTag === tag.slug
                              ? classes.colorState3
                              : classes.colorState4,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {tag.label}
                        </Typography>
                      </Action>
                    ))}
                  </div>
                ))}
              </div>

              {/* Clear filter button */}
              {selectedTag && (
                <Action
                  onClick={() => {
                    onSelectTag(null);
                    closeDrawer();
                  }}
                  className={({ pressed }) =>
                    [classes.action4, pressed ? classes.opacityState5 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Typography className={classes.clearButtonText}>
                    Сбросить фильтр ×
                  </Typography>
                </Action>
              )}
            </div>
          </ScrollArea>
        </div>
      </Animated.div>
    </>
  );
}
