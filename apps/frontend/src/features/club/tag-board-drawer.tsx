"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getTagBoardDrawerLayout } from "./tag-board-drawer.layout";
import classes from "./tag-board-drawer.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Action, Typography } from "@/shared/ui/elements";
import { useEffect, useCallback } from "react";
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

  // translateX: 0 = fully open (drawer visible), DRAWER_WIDTH = fully closed (hidden off-screen right)
  const translateX = useSharedValue(DRAWER_WIDTH);
  const isOpenRef = useSharedValue(false);
  // Peek animation — subtle jiggle of the edge strip
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
  useEffect(() => {
    startPeekAnimation();
  }, [startPeekAnimation]);
  const stopPeekAnimation = useCallback(() => {
    peekAnim.value = withTiming(0, { duration: 100 });
  }, [peekAnim]);
  const openDrawer = useCallback(() => {
    isOpenRef.value = true;
    translateX.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    stopPeekAnimation();
  }, [isOpenRef, stopPeekAnimation, translateX]);
  const closeDrawer = useCallback(() => {
    isOpenRef.value = false;
    translateX.value = withTiming(DRAWER_WIDTH, {
      duration: 280,
      easing: Easing.in(Easing.cubic),
    });
    // Restart peek after closing
    setTimeout(() => {
      startPeekAnimation();
    }, 1500);
  }, [DRAWER_WIDTH, isOpenRef, startPeekAnimation, translateX]);
  // Animated styles
  const drawerStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ translateX: translateX.value }]),
  }));
  const peekStyle = useAnimatedStyle(() => {
    const drawerClosed = translateX.value >= DRAWER_WIDTH - 1;
    return {
      transform: cssTransform([
        { translateX: drawerClosed ? peekAnim.value : 0 },
      ]),
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
      {/* Peek strip — visible edge that jiggles, tap to open */}
      <Animated.div
        style={[{ top: stylesLayout.peekStrip.top }, peekStyle]}
        className={classes.div}
      >
        <Action
          onClick={openDrawer}
          className={({ pressed }) =>
            [classes.action, pressed ? classes.opacityState : ""]
              .filter(Boolean)
              .join(" ")
          }
        >
          <div
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
            onClick={closeDrawer}
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
          <div
            style={{
              top: stylesLayout.drawerContent.top,
              left: stylesLayout.drawerContent.left,
              right: stylesLayout.drawerContent.right,
              height: stylesLayout.drawerContent.height,
              paddingTop: stylesLayout.drawerContent.paddingTop,
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
          </div>
        </div>
      </Animated.div>
    </>
  );
}
