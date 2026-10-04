"use client";
import { TabHeader } from "@/shared/ui/tab-header";
import classes from "./library-screen.module.scss";
import {
  Action,
  Typography,
  Background,
  ScrollArea,
  Field,
} from "@/shared/ui/elements";
import { useState, useMemo, useCallback } from "react";
import { useViewport } from "@/shared/browser/viewport";
import { getLibraryScreenContent } from "./library-screen.content";
import { useRouter } from "@/shared/navigation/router";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";

import { useClub } from "@/domain/subscription/subscription-context";
import { trpc } from "@/shared/api/trpc";
import * as WebBrowser from "@/shared/browser/links";
import {
  PAPER_TEXTURE_URI,
  DEFAULT_COVER_ASPECT,
  BANNER_URL,
  ABOUT_ME_COVER_URL,
  BROWN,
  BROWN_MUTED,
  MATERIALS,
  GRID_GAP,
  CARD_META_HEIGHT,
} from "./library-screen.content";
import type { MaterialItem } from "./library-screen.content";
function splitMasonryColumns(
  items: MaterialItem[],
  aspectFor: (item: MaterialItem) => number,
  columnWidth: number,
) {
  const left: MaterialItem[] = [];
  const right: MaterialItem[] = [];
  let leftHeight = 0;
  let rightHeight = 0;
  for (const item of items) {
    const aspect = aspectFor(item);
    const imageHeight = columnWidth / Math.max(aspect, 0.35);
    const blockHeight = imageHeight + CARD_META_HEIGHT;
    if (leftHeight <= rightHeight) {
      left.push(item);
      leftHeight += blockHeight + GRID_GAP;
    } else {
      right.push(item);
      rightHeight += blockHeight + GRID_GAP;
    }
  }
  return { left, right };
}
export default function LibraryScreen() {
  const router = useRouter();
  const { COLUMN_WIDTH: columnWidth } = getLibraryScreenContent(useViewport());
  const [searchQuery, setSearchQuery] = useState("");
  const [coverAspects, setCoverAspects] = useState<Record<string, number>>({});
  const { isSubscribed } = useClub();
  const articlesQuery = trpc.articles.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const allMaterials = useMemo(() => {
    const extra: MaterialItem[] = (articlesQuery.data || []).map((article) => ({
      id: `article-${article.id}`,
      title: article.title,
      coverUrl: article.coverUrl || ABOUT_ME_COVER_URL,
      coverAspectRatio: DEFAULT_COVER_ASPECT,
      isClubOnly: true,
      action: "navigate" as const,
      route: `/library/article/${article.id}`,
    }));
    return [...MATERIALS, ...extra];
  }, [articlesQuery.data]);
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return allMaterials;
    const query = searchQuery.toLowerCase();
    return allMaterials.filter((item) =>
      item.title.toLowerCase().includes(query),
    );
  }, [searchQuery, allMaterials]);
  const handleMaterialPress = async (item: MaterialItem) => {
    if (item.isClubOnly && !isSubscribed) {
      router.push("/club");
      return;
    }
    if (item.action === "navigate" && item.route) {
      router.push(item.route);
    } else if (item.action === "browser" && item.pdfUrl) {
      await WebBrowser.openBrowserAsync(item.pdfUrl);
    }
  };
  const getActionLabel = (item: MaterialItem): string => {
    if (item.isClubOnly && !isSubscribed) {
      return "Для участниц клуба Darcy →";
    }
    if (item.action === "browser") return "Скачать →";
    return "Читать →";
  };
  const aspectFor = useCallback(
    (item: MaterialItem) =>
      coverAspects[item.id] ?? item.coverAspectRatio ?? DEFAULT_COVER_ASPECT,
    [coverAspects],
  );
  const masonry = useMemo(
    () => splitMasonryColumns(filteredMaterials, aspectFor, columnWidth),
    [filteredMaterials, aspectFor, columnWidth],
  );
  const rememberCoverAspect = (
    itemId: string,
    width: number,
    height: number,
  ) => {
    if (!width || !height) return;
    const next = width / height;
    setCoverAspects((prev) =>
      prev[itemId] === next ? prev : { ...prev, [itemId]: next },
    );
  };
  const renderCard = (item: MaterialItem) => {
    const aspect = aspectFor(item);
    return (
      <div
        key={item.id}
        className={["ui-stack ", classes.cardWrapper].filter(Boolean).join(" ")}
      >
        <Action
          onClick={() => handleMaterialPress(item)}
          className={({ pressed }) =>
            [
              classes.action,
              pressed ? classes.opacityState : classes.opacityState2,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Picture
            source={{ uri: item.coverUrl }}
            style={{ aspectRatio: aspect }}
            contentFit={item.id === "loshadka" ? "cover" : "contain"}
            contentPosition={item.id === "loshadka" ? "top" : "center"}
            transition={300}
            onLoad={(event) => {
              if (item.id === "loshadka") return;
              const { width, height } = event.source;
              rememberCoverAspect(item.id, width, height);
            }}
            className={classes.picture}
          />
        </Action>

        <Typography lines={2} className={classes.cardTitle}>
          {item.title}
        </Typography>

        <Action
          onClick={() => handleMaterialPress(item)}
          activeOpacity={0.7}
          style={{
            ...((item.isClubOnly && !isSubscribed ? true : false)
              ? {
                  borderWidth: item.isClubOnly && !isSubscribed ? 1 : undefined,
                }
              : {}),
            ...((item.isClubOnly && !isSubscribed ? true : false)
              ? {
                  borderColor:
                    item.isClubOnly && !isSubscribed
                      ? "rgba(160,132,92,0.2)"
                      : undefined,
                }
              : {}),
          }}
          className={[
            classes.actionButtonLocked,
            item.isClubOnly && !isSubscribed
              ? classes.backgroundColorState
              : classes.backgroundColorState2,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {item.isClubOnly && !isSubscribed ? (
            <div
              className={["ui-stack ", classes.actionButtonContent]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons name="lock" size={12} color={BROWN_MUTED} />
              <Typography className={classes.actionButtonLockedText}>
                {getActionLabel(item)}
              </Typography>
            </div>
          ) : (
            <div
              className={["ui-stack ", classes.actionButtonContent]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name={item.action === "browser" ? "file-download" : "menu-book"}
                size={13}
                color={BROWN}
              />
              <Typography className={classes.actionButtonActiveText}>
                {getActionLabel(item)}
              </Typography>
            </div>
          )}
        </Action>
      </div>
    );
  };
  return (
    <Background
      source={{ uri: PAPER_TEXTURE_URI }}
      fit="cover"
      className={classes.container}
    >
      <TabHeader />
      <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
        {/* Hero Banner */}
        <div
          className={["ui-stack ", classes.heroBanner]
            .filter(Boolean)
            .join(" ")}
        >
          <Picture
            source={{ uri: BANNER_URL }}
            contentFit="cover"
            className={classes.heroBannerImage}
          />
          <div
            className={["ui-stack ", classes.heroBannerOverlay]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.heroBannerTitle}>
              БИБЛИОТЕКА
            </Typography>
          </div>
        </div>

        {/* Search bar */}
        <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
          <MaterialIcons name="search" size={20} color={BROWN_MUTED} />
          <Field
            placeholder="Поиск материалов..."
            placeholderColor={BROWN_MUTED}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className={classes.field}
          />
          {searchQuery.length > 0 && (
            <Action onClick={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color={BROWN_MUTED} />
            </Action>
          )}
        </div>

        {filteredMaterials.length === 0 ? (
          <div
            className={["ui-stack ", classes.emptyContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons name="search-off" size={48} color={BROWN_MUTED} />
            <Typography className={classes.emptyText}>
              Ничего не найдено
            </Typography>
          </div>
        ) : (
          <div
            className={["ui-stack ", classes.masonry].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.masonryColumn]
                .filter(Boolean)
                .join(" ")}
            >
              {masonry.left.map((item) => renderCard(item))}
            </div>
            <div
              className={["ui-stack ", classes.masonryColumn]
                .filter(Boolean)
                .join(" ")}
            >
              {masonry.right.map((item) => renderCard(item))}
            </div>
          </div>
        )}
      </ScrollArea>
    </Background>
  );
}
