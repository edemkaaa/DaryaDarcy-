"use client";
/** Общая геометрия страницы ролика получает готовый плеер и подсказку, не принимая решения о доступе. */
import type { ReactNode } from "react";
import { useViewport } from "@/shared/browser/viewport";
import { getVideoScreenLayout } from "./video-screen.layout";
import classes from "./video-screen.module.scss";
import {
  Background,
  ScrollArea,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { PAPER_TEXTURE_URI } from "./video-screen.content";
export function VideoDetailView({
  title,
  player,
  youtubeId,
  meta,
  hint,
}: {
  title: string;
  player: ReactNode;
  youtubeId?: string;
  meta?: string;
  hint: string;
}) {
  const { stylesLayout } = getVideoScreenLayout(useViewport());
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea className={classes.container}>
          {/* Video player area */}
          <div
            style={{
              width: stylesLayout.videoContainer.width,
              height: stylesLayout.videoContainer.height,
            }}
            className={["ui-stack ", classes.videoContainer]
              .filter(Boolean)
              .join(" ")}
          >
            {player}
          </div>

          {/* Video info */}
          <div
            className={["ui-stack ", classes.infoContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.title}>{title}</Typography>

            {meta ? (
              <Typography className={classes.meta}>{meta}</Typography>
            ) : null}
            <Typography className={classes.qualityHint}>{hint}</Typography>

            {youtubeId ? (
              <Action
                onClick={() =>
                  void openExternalUrl(
                    `https://www.youtube.com/watch?v=${youtubeId}`,
                  )
                }
                className={({ pressed }) =>
                  [classes.action2, pressed ? classes.opacityState2 : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons
                  name="play-circle-outline"
                  size={20}
                  color="#5C4033"
                />
                <Typography className={classes.youtubeBtnText}>
                  Смотреть на YouTube →
                </Typography>
              </Action>
            ) : null}
          </div>
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
