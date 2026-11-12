"use client";
/** Витрина библиотеки различает переход в материал и выдачу файла; обложка сама по себе не подтверждает доступ к содержимому. */
import classes from "./library-screen.module.scss";
import {
  Action,
  Typography,
  Background,
  ScrollArea,
  Field,
} from "@/shared/ui/elements";
import { useState, useMemo, useEffect } from "react";
import { useViewport } from "@/shared/browser/viewport";
import { getLibraryScreenContent } from "./library-screen.content";
import { useRouter } from "@/shared/navigation/router";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { Picture } from "@/shared/media/image";
import { imageSlotSizes } from "@/shared/media/image-sizes";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { isTemporaryRequestError } from "@/shared/api/errors";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import type { LibraryMaterialKey } from "./library-files-api";
import { LibraryFilesDialog } from "./library-files-dialog";

import { useClub } from "@/domain/subscription/subscription-context";
import { trpc } from "@/shared/api/trpc";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
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
/** Сохраняем исходную очередность карточек, каждый раз добавляя следующую в более короткую колонку по оценке высоты обложки и подписи. */
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
/** Объединяем статические материалы и статьи API; тип действия определяет переход, внешний PDF или диалог защищённых файлов. */
export default function LibraryScreen() {
  const active = useScreenActive();
  const router = useRouter();
  const { COLUMN_WIDTH: columnWidth } = getLibraryScreenContent(useViewport());
  const [searchQuery, setSearchQuery] = useState("");
  const [fileMaterial, setFileMaterial] = useState<{
    key: LibraryMaterialKey;
    title: string;
  } | null>(null);
  const { hasClubAccess } = useClub();
  /** Закрываем диалог файлов сразу после потери клубного доступа. */
  useEffect(() => {
    if (!hasClubAccess) setFileMaterial(null);
  }, [hasClubAccess]);
  const articlesQuery = trpc.articles.list.useQuery(undefined, {
    staleTime: 30_000,
    ...contentRefreshOptions(active),
  });
  const articlesRefreshError =
    articlesQuery.data !== undefined &&
    articlesQuery.isError &&
    isTemporaryRequestError(articlesQuery.error);
  useBackgroundNotice({
    when: articlesRefreshError,
    message: "Не удалось обновить статьи библиотеки",
    onRetry: () => articlesQuery.refetch({ cancelRefetch: false }),
  });
  const allMaterials = useMemo(() => {
    const extra: MaterialItem[] = (articlesQuery.data || []).map((article) => ({
      id: `article-${article.id}`,
      title: article.title,
      coverUrl: article.coverUrl || ABOUT_ME_COVER_URL,
      coverAspectRatio: DEFAULT_COVER_ASPECT,
      isClubOnly: article.access !== "public",
      action: "navigate" as const,
      route: `/library/article/${article.id}`,
    }));
    return [...MATERIALS, ...extra];
  }, [articlesQuery.data]);
  const filteredMaterials = useMemo(() => {
    if (!searchQuery.trim()) return allMaterials;
    const query = searchQuery.trim().toLowerCase();
    return allMaterials.filter((item) =>
      item.title.toLowerCase().includes(query),
    );
  }, [searchQuery, allMaterials]);
  /** Проверяем клубный доступ перед выбором действия, затем открываем ровно предусмотренный карточкой маршрут или файл. */
  const handleMaterialPress = async (item: MaterialItem) => {
    if (item.isClubOnly && !hasClubAccess) {
      router.push("/club");
      return;
    }
    if (item.action === "navigate") {
      router.push(item.route);
    } else if (item.action === "private-file") {
      setFileMaterial({ key: item.material, title: item.title });
    } else if (item.action === "browser") {
      await WebBrowser.openBrowserAsync(item.pdfUrl);
    }
  };
  /** Согласуем подпись с доступом и действием карточки, не раскрывая содержимое закрытого файла. */
  const getActionLabel = (item: MaterialItem): string => {
    if (item.isClubOnly && !hasClubAccess) {
      return "Для участниц клуба Darcy →";
    }
    if (item.action !== "navigate" || item.route === "/library/patterns")
      return "Скачать →";
    return "Читать →";
  };
  const masonry = useMemo(
    () =>
      splitMasonryColumns(
        filteredMaterials,
        (item) => item.coverAspectRatio,
        columnWidth,
      ),
    [filteredMaterials, columnWidth],
  );
  /** Собираем обложку, название и действие из одной карточки; обе области нажатия используют одинаковую проверку доступа. */
  const renderCard = (item: MaterialItem) => {
    const aspect = item.coverAspectRatio;
    return (
      <div
        key={item.id}
        className={["ui-stack ", classes.cardWrapper].filter(Boolean).join(" ")}
      >
        <Action
          aria-label={`Открыть материал: ${item.title}`}
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
            sizes={imageSlotSizes(2, 32, 12)}
            style={{ aspectRatio: aspect }}
            contentFit={item.id === "loshadka" ? "cover" : "contain"}
            contentPosition={item.id === "loshadka" ? "top" : "center"}
            transition={300}
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
            ...((item.isClubOnly && !hasClubAccess ? true : false)
              ? {
                  borderWidth:
                    item.isClubOnly && !hasClubAccess ? 1 : undefined,
                }
              : {}),
            ...((item.isClubOnly && !hasClubAccess ? true : false)
              ? {
                  borderColor:
                    item.isClubOnly && !hasClubAccess
                      ? "rgba(160,132,92,0.2)"
                      : undefined,
                }
              : {}),
          }}
          className={[
            classes.actionButtonLocked,
            item.isClubOnly && !hasClubAccess
              ? classes.backgroundColorState
              : classes.backgroundColorState2,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {item.isClubOnly && !hasClubAccess ? (
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
                name={
                  item.action !== "navigate" ? "file-download" : "menu-book"
                }
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
          <MaterialIcons
            name="search"
            size={18}
            color="var(--search-muted-color)"
          />
          <Field
            aria-label="Поиск по библиотеке"
            placeholder="Поиск материалов..."
            placeholderColor="var(--search-muted-color)"
            value={searchQuery}
            onValueChange={setSearchQuery}
            className={classes.field}
          />
          {searchQuery.length > 0 && (
            <Action
              aria-label="Очистить поиск"
              onClick={() => setSearchQuery("")}
              activeOpacity={0.5}
            >
              <MaterialIcons
                name="close"
                size={18}
                color="var(--search-muted-color)"
              />
            </Action>
          )}
        </div>

        {filteredMaterials.length === 0 &&
        !articlesQuery.isPending &&
        !articlesQuery.isError ? (
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
        <QueryRetryState
          isLoading={articlesQuery.isPending}
          loadingContent={<ContentPlaceholder kind="library" />}
          isError={articlesQuery.isError && !articlesRefreshError}
          onRetry={() => void articlesQuery.refetch()}
          message="Не удалось загрузить статьи библиотеки"
        />
      </ScrollArea>
      {fileMaterial && hasClubAccess ? (
        <LibraryFilesDialog
          key={fileMaterial.key}
          material={fileMaterial.key}
          title={fileMaterial.title}
          onClose={() => setFileMaterial(null)}
        />
      ) : null}
    </Background>
  );
}
