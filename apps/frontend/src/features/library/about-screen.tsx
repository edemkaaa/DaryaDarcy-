"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getAboutScreenLayout } from "./about-screen.layout";
import classes from "./about-screen.module.scss";
import {
  type VisibleItem,
  Action,
  Background,
  ScrollArea,
  Typography,
  Collection,
  MeasuredBox,
} from "@/shared/ui/elements";
import { useRef, useState, useCallback } from "react";
import { Picture } from "@/shared/media/image";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import { useRouter } from "@/shared/navigation/router";
import {
  PAPER_TEXTURE_URI,
  CAROUSEL_IMAGES,
  PART_PHOTOS,
  PART_TITLES,
  PART_SUBTITLES,
  PART_TEXTS,
} from "./about-screen.content";
export default function AboutMeScreen() {
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getAboutScreenLayout(viewport);

  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [tocExpanded, setTocExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionPositions = useRef<Record<number, number>>({});
  const handleBack = () => {
    router.back();
  };
  const openViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };
  const scrollToSection = (index: number) => {
    const y = sectionPositions.current[index];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ top: y - 20, behavior: "smooth" });
    }
  };
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onVisibleItemsChange = useCallback(
    ({ visibleItems }: { visibleItems: VisibleItem[] }) => {
      if (visibleItems.length > 0 && visibleItems[0].index != null) {
        setActiveIndex(visibleItems[0].index);
      }
    },
    [],
  );
  const visiblePercent = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;
  const renderCarouselItem = ({
    item,
    index,
  }: {
    item: string;
    index: number;
  }) => (
    <Action
      aria-label={`Открыть фото ${index + 1}`}
      activeOpacity={0.9}
      onClick={() => openViewer(CAROUSEL_IMAGES, index)}
      style={{ width: stylesLayout.carouselItem.width }}
      className={classes.carouselItem}
    >
      <Picture
        source={{ uri: item }}
        contentFit="cover"
        className={classes.carouselImage}
      />
    </Action>
  );
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea
          ref={scrollRef}
          hideScrollbar
          contentClassName={classes.scrollContent}
        >
          {/* Back Button */}
          <div
            className={["ui-stack ", classes.backButtonRow]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={handleBack}
              activeOpacity={0.7}
              className={classes.backButton}
            >
              <Typography className={classes.backButtonText}>
                ← Назад
              </Typography>
            </Action>
          </div>

          {/* Carousel */}
          <div
            className={["ui-stack ", classes.carouselContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Collection
              data={CAROUSEL_IMAGES}
              renderItem={renderCarouselItem}
              keyExtractor={(_, i) => `carousel-${i}`}
              horizontal
              paging
              hideScrollbar
              onVisibleItemsChange={onVisibleItemsChange}
              visiblePercent={visiblePercent.viewAreaCoveragePercentThreshold}
            />
            {/* Dot indicators */}
            <div
              className={["ui-stack ", classes.dotsContainer]
                .filter(Boolean)
                .join(" ")}
            >
              {CAROUSEL_IMAGES.map((_, i) => (
                <div
                  key={`dot-${i}`}
                  className={[
                    "ui-stack ",
                    i === activeIndex
                      ? classes.appearanceState
                      : classes.appearanceState2,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <div
            className={["ui-stack ", classes.titleContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.pageTitle}>
              ТВОРЧЕСКИЙ ПУТЬ
            </Typography>
          </div>

          {/* Table of Contents */}
          <div
            className={["ui-stack ", classes.tocContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={() => setTocExpanded(!tocExpanded)}
              activeOpacity={0.7}
              className={classes.tocHeader}
            >
              <Typography className={classes.tocTitle}>ОГЛАВЛЕНИЕ</Typography>
              <Typography className={classes.tocToggle}>
                {tocExpanded ? "\u25B2" : "\u25BC"}
              </Typography>
            </Action>
            {tocExpanded &&
              PART_TITLES.map((title, index) => (
                <Action
                  key={`toc-${index}`}
                  onClick={() => scrollToSection(index)}
                  activeOpacity={0.7}
                  className={classes.tocItem}
                >
                  <Typography className={classes.tocName}>{title}</Typography>
                </Action>
              ))}
          </div>

          {/* Parts */}
          {PART_TEXTS.map((text, index) => (
            <MeasuredBox
              key={`part-${index}`}
              onResize={(e) => {
                sectionPositions.current[index] = e.y;
              }}
              className={classes.partContainer}
            >
              {/* Part heading */}
              <Typography className={classes.partHeading}>
                {PART_TITLES[index]}
              </Typography>
              <Typography className={classes.partSubtitle}>
                {PART_SUBTITLES[index]}
              </Typography>

              {/* Part photo (tappable for fullscreen) */}
              <Action
                aria-label={`Открыть фото раздела ${index + 1}`}
                activeOpacity={0.9}
                onClick={() => openViewer([PART_PHOTOS[index]], 0)}
              >
                <div
                  className={["ui-stack ", classes.partImageContainer]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={{ uri: PART_PHOTOS[index] }}
                    contentFit="cover"
                    className={classes.carouselImage}
                  />
                </div>
              </Action>

              {/* Part text */}
              <Typography className={classes.partText}>{text}</Typography>
            </MeasuredBox>
          ))}

          {/* End */}
          <div
            className={["ui-stack ", classes.endContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.endText}>
              ~ продолжение следует ~
            </Typography>
          </div>

          {/* Back to top button */}
          <Action
            onClick={scrollToTop}
            activeOpacity={0.7}
            className={classes.backToTopButton}
          >
            <Typography className={classes.backToTopText}>↑ Наверх</Typography>
          </Action>
        </ScrollArea>
      </Background>

      {/* Fullscreen Photo Viewer */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
    </ScreenContainer>
  );
}
