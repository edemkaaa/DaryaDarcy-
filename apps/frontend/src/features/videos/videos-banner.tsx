"use client";
/** Декоративная шапка каталога отделена от списка, чтобы подгрузка роликов не меняла её жизненный цикл. */
import { useEffect, useState } from "react";
import { Picture } from "@/shared/media/image";
import { Typography } from "@/shared/ui/elements";
import Animated, { FadeIn } from "@/shared/browser/motion";
import {
  VIDEO_FILM_DECOR_URL,
  VIDEO_ROSE_DECOR_URL,
} from "@/shared/styles/tab-assets";
import classes from "./videos-screen.module.scss";

function BannerContent() {
  return (
    <>
      <Picture
        source={{ uri: VIDEO_FILM_DECOR_URL }}
        contentFit="contain"
        className={classes.filmDecor}
      />
      <Typography className={classes.headerTitle}>ВИДЕО</Typography>
      <Typography className={classes.headerSubtitle}>
        мини-фильмы об уютной жизни
      </Typography>
      <Picture
        source={{ uri: VIDEO_ROSE_DECOR_URL }}
        contentFit="contain"
        className={classes.roseLeft}
      />
      <Picture
        source={{ uri: VIDEO_ROSE_DECOR_URL }}
        contentFit="contain"
        className={classes.roseRight}
      />
    </>
  );
}

// Only actual browser entry marks this flag, never server rendering.
let bannerHasEntered = false;
export function VideosBannerHeader() {
  const [entering] = useState(() =>
    bannerHasEntered ? undefined : FadeIn.duration(600),
  );
  useEffect(() => {
    bannerHasEntered = true;
  }, []);
  return (
    <Animated.div entering={entering} className={classes.headerSection}>
      <BannerContent />
    </Animated.div>
  );
}
