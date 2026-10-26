"use client";
import { useClubAppearance } from "@/domain/launch/use-club-appearance";
import { usePreparedAppearance } from "./use-prepared-appearance";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { useViewport } from "@/shared/browser/viewport";

import { getClubSubscribedLayout } from "./club-subscribed.layout";
import classes from "./club-subscribed.module.scss";
import {
  Typography,
  Action,
  Background,
  Collection,
  Dialog,
} from "@/shared/ui/elements";
import { ClubPostCard } from "./club-post-card";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAuth } from "@/domain/session/session-context";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { SafeArea } from "@/shared/ui/safe-area";

import { PenPals } from "@/features/club/pen-pals";
import { useCapabilities } from "@/shared/api/capabilities";
import { ProfileSetup } from "@/features/club/profile-setup";
import { TagBoardDrawer } from "@/features/club/tag-board-drawer";
import { ScrollToTopButton } from "@/shared/ui/scroll-to-top-button";
import { AdminFAB } from "@/features/admin/admin-fab";
import { usePostManagement } from "@/features/admin/post-management";
import { usePostInteractions } from "@/domain/post/use-post-interactions";
import { PostInteractionStatus } from "@/domain/post/post-interaction-status";
import { trpc } from "@/shared/api/trpc";
import { getQueryKey } from "@trpc/react-query";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import { invalidResponse } from "@/shared/api/errors";
import {
  displayPostTitle,
  isRawMediaFilename,
} from "@/shared/media/media-label";
import {
  sanitizePlainPostText,
  sanitizeRichTextForDisplay,
} from "@/domain/content/post-text-sanitize";
import { postDisplayDate } from "@/domain/post/post-date";
import { articleIdFromSource } from "@/domain/content/article-blocks";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import { useClubContentProtection } from "@/shared/browser/use-club-protection";
import {
  CREAM,
  PAPER_TEXTURE_URI,
  SEASONAL_TARTANS,
  SEASONAL_BANNERS,
  CLUB_TABS,
  MAILBOX_URI,
  PEN_PALS_ENABLED,
} from "./club-subscribed.content";
import type { ClubTab, ClubPost } from "./club-subscribed.content";
export function ClubSubscribed({
  purchaseNotice,
}: {
  purchaseNotice?: ReactNode;
}) {
  const active = useScreenActive();
  const appearanceQuery = useClubAppearance();
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const capabilities = useCapabilities();
  const penPalsAvailable = PEN_PALS_ENABLED && capabilities.penPals;
  const viewport = useViewport();

  const [activeTab, setActiveTab] = useState<ClubTab | null>(null);
  const [showPenPals, setShowPenPals] = useState(false);
  const { user, isOwner } = useAuth();
  const [setupHidden, setSetupHidden] = useState(() =>
    Boolean(user?.name?.trim() && user?.gender),
  );
  const [selectedBoardTag, setSelectedBoardTag] = useState<string | null>(null);
  useClubContentProtection(true);
  const utils = trpc.useUtils();
  // Admin post management (edit/delete)
  const onRefresh = () => {
    void clubQuery.restart();
  };
  const { openMenu, ManagementModals } = usePostManagement(onRefresh);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const clubTabsRef = useRef<HTMLDivElement>(null);
  const [clubMenuHeight, setClubMenuHeight] = useState(86);
  useEffect(() => {
    const tabs = clubTabsRef.current;
    if (!tabs) return;
    const measure = () => {
      const height = tabs.getBoundingClientRect().height;
      // Retained tabs are hidden between visits; keep their measured clearance.
      if (height > 0) setClubMenuHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tabs, { box: "border-box" });
    return () => observer.disconnect();
  }, []);
  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };
  const handleClubLike = (postId: string) => interactions.like(Number(postId));
  const handleClubSave = (postId: string) => interactions.save(Number(postId));
  const needsProfileSetup = !setupHidden && !isOwner;
  const displayName = user?.name;
  const displayGender = user?.gender;
  const clubFilters = {
    limit: 12,
    ...(activeTab ? { category: activeTab } : {}),
    ...(selectedBoardTag ? { tag: selectedBoardTag } : {}),
  };
  const clubQuery = useCursorPages({
    key: getQueryKey(trpc.club.listByCategory, clubFilters, "query"),
    scope: String(user?.id ?? "guest"),
    enabled: active,
    fetchPage: async (cursor, signal) => {
      // Offset cursors remain numeric on the wire. The local cursor-chain
      // helper uses strings and refreshes only the first page in the background.
      const page = await utils.client.club.listByCategory.query(
        {
          ...clubFilters,
          ...(cursor === null ? {} : { cursor: Number(cursor) }),
        },
        { signal },
      );
      if (
        page.nextCursor !== null &&
        (!Number.isSafeInteger(page.nextCursor) || page.nextCursor < 0)
      )
        throw invalidResponse();
      return {
        items: page.posts,
        nextCursor: page.nextCursor === null ? null : String(page.nextCursor),
      };
    },
  });
  const hasPageError = clubQuery.isError;
  const backgroundPostError =
    clubQuery.isRefetchError &&
    !clubQuery.isFetchNextPageError &&
    clubQuery.data !== undefined;
  useBackgroundNotice({
    when: backgroundPostError,
    message: "Не удалось обновить публикации клуба",
    onRetry: () => clubQuery.refetch({ cancelRefetch: false }),
  });
  const { fetchNextPage, hasNextPage, isFetching, isError } = clubQuery;
  const loadMore = useCallback(() => {
    if (active && hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [active, fetchNextPage, hasNextPage, isFetching, isError]);
  const retryPosts = () => {
    if (clubQuery.isFetching) return;
    if (clubQuery.isFetchNextPageError) void clubQuery.fetchNextPage();
    else void clubQuery.refetch({ cancelRefetch: false });
  };
  const rows = clubQuery.items;
  const interactions = usePostInteractions(rows.map((post) => post.id));
  // Convert API posts to the club presentation model.
  const dbPosts: ClubPost[] = rows
    .map((row) => {
      const p: typeof row & Pick<ClubPost, "media" | "commentCount"> = row;
      const cleanLines = String(p.text || "")
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && !isRawMediaFilename(line));
      const body = cleanLines.join("\n");
      const displayDate = postDisplayDate(p);
      const rawText = sanitizePlainPostText(String(p.text || ""));
      return {
        id: String(p.id),
        target: p.target,
        title: displayPostTitle(rawText),
        preview: sanitizePlainPostText(body),
        rawText,
        date: displayDate
          ? displayDate.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "",
        createdAt: displayDate,
        publishedAt: p.publishedAt ?? p.createdAt ?? null,
        tags: (p.tags as string[]) || [],
        photos: p.photos || [],
        media: p.media || [],
        richText: sanitizeRichTextForDisplay(p.richText),
        articleId: articleIdFromSource(p.source),
        commentCount: Number(p.commentCount) || 0,
      };
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  // The server applies rubric and board-tag aliases before pagination.
  const posts = dbPosts;
  // Winter is an error fallback, never a placeholder for a pending response.
  const season =
    appearanceQuery.data?.season ?? (appearanceQuery.isError ? "winter" : null);
  const builtInSeason = season === "autumn" ? "autumn" : "winter";
  const backgroundCandidates = season
    ? [
        appearanceQuery.data?.appearance.backgroundUrl,
        SEASONAL_TARTANS[builtInSeason],
        PAPER_TEXTURE_URI,
      ]
    : [];
  const bannerCandidates = season
    ? [
        appearanceQuery.data?.appearance.bannerUrl,
        SEASONAL_BANNERS[builtInSeason],
      ]
    : [];
  const tartanUri =
    backgroundCandidates.find((url) => url && !failedImages.includes(url)) ??
    null;
  const bannerUri =
    bannerCandidates.find((url) => url && !failedImages.includes(url)) ?? null;
  const imageError = [
    backgroundCandidates.find(Boolean),
    bannerCandidates.find(Boolean),
  ].some((url) => url && failedImages.includes(url));
  const failImage = useCallback((url: string | null) => {
    if (url)
      setFailedImages((previous) =>
        previous.includes(url) ? previous : [...previous, url],
      );
  }, []);
  const preparedAppearance = usePreparedAppearance(
    season,
    tartanUri,
    bannerUri,
    failImage,
  );
  const displayedBackground = preparedAppearance?.background ?? null;
  const displayedBanner = preparedAppearance?.banner ?? null;
  // Fit configured winter artwork in full. Keep the built-in fallback and
  // other seasons unchanged; pending settings must not resize the old theme.
  const bannerSize =
    preparedAppearance?.season === "winter" &&
    displayedBanner &&
    displayedBanner !== SEASONAL_BANNERS.winter
      ? preparedAppearance.bannerSize
      : null;
  const { stylesLayout } = getClubSubscribedLayout(viewport, bannerSize);
  const retryAppearance = () => {
    setFailedImages([]);
    return appearanceQuery.refetch({ cancelRefetch: false });
  };
  useBackgroundNotice({
    when: appearanceQuery.isError || imageError,
    message:
      "Не удалось обновить оформление Клуба. Используется доступное оформление.",
    onRetry: retryAppearance,
  });
  const renderPost = ({ item }: { item: ClubPost }) => (
    <ClubPostCard
      item={item}
      isSaved={interactions.savedIds.has(Number(item.id))}
      isLiked={interactions.likedIds.has(Number(item.id))}
      likePending={
        !interactions.isReady(Number(item.id)) ||
        interactions.isPending("like", Number(item.id))
      }
      savePending={
        !interactions.isReady(Number(item.id)) ||
        interactions.isPending("save", Number(item.id))
      }
      onSave={() => handleClubSave(item.id)}
      onLike={() => handleClubLike(item.id)}
      onMenuPress={
        isOwner && !isNaN(Number(item.id))
          ? () =>
              openMenu({
                id: Number(item.id),
                text:
                  (
                    item as ClubPost & {
                      rawText?: string;
                    }
                  ).rawText ?? item.preview,
                photos: item.photos || [],
                tags: item.tags,
                media: item.media || [],
                richText: item.richText ?? null,
                publishedAt: item.publishedAt ?? item.createdAt ?? null,
                createdAt: item.createdAt ?? null,
                target: item.target,
              })
          : undefined
      }
      onPhotoPress={openPhotoViewer}
    />
  );
  // Banner image as the first element in the scrollable list
  const ListHeader = () => (
    <div className="ui-stack ">
      <PostInteractionStatus
        error={interactions.error}
        retry={interactions.retry}
      />
      <div
        data-testid="club-season-banner"
        style={{
          width: stylesLayout.bannerContainer.width,
          height: stylesLayout.bannerContainer.height,
        }}
        className={["ui-stack ", classes.bannerContainer]
          .filter(Boolean)
          .join(" ")}
      >
        {displayedBanner ? (
          <Picture
            source={{ uri: displayedBanner }}
            onError={() => failImage(displayedBanner)}
            contentFit={bannerSize ? "contain" : "cover"}
            contentPosition="top"
            className={classes.bannerImage}
            loading="eager"
            fetchPriority="high"
          />
        ) : null}
      </div>
      {/* Greeting only on main (no tab selected) */}
      {activeTab === null && displayName ? (
        <Typography className={classes.greeting}>
          Очень рада тебе,{" "}
          {displayGender === "female"
            ? "дорогая "
            : displayGender === "male"
              ? "дорогой "
              : ""}
          {displayName}
        </Typography>
      ) : null}
      {/* Mailbox + Pen Pals CTA on Community tab */}
      {activeTab === "community" ? (
        <div
          className={["ui-stack ", classes.communityIntro]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.wednesdayNote}>
            Каждую среду — день тёплого общения
          </Typography>
          <div
            className={["ui-stack ", classes.mailboxSection]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={{ uri: MAILBOX_URI }}
              contentFit="contain"
              className={classes.mailboxImage}
            />
            {penPalsAvailable ? (
              <Action
                onClick={() => setShowPenPals(true)}
                className={({ pressed }) =>
                  [
                    classes.action,
                    pressed ? classes.opacityState : "",
                    pressed ? classes.transformState : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography className={classes.penPalsCtaText}>
                  найти друга по переписке →
                </Typography>
              </Action>
            ) : (
              <div className={classes.action}>
                <Typography className={classes.penPalsCtaText}>
                  Почтовое отделение — скоро
                </Typography>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {/* Active tag filter indicator */}
      {selectedBoardTag ? (
        <div
          className={["ui-stack ", classes.activeFilterRow]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.activeFilterLabel}>Фильтр:</Typography>
          <Action
            aria-label={`Сбросить фильтр клуба: ${selectedBoardTag}`}
            onClick={() => setSelectedBoardTag(null)}
            className={({ pressed }) =>
              [classes.action2, pressed ? classes.opacityState2 : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Typography className={classes.activeFilterChipText}>
              {selectedBoardTag} ×
            </Typography>
          </Action>
        </div>
      ) : null}
    </div>
  );
  return (
    <Background
      source={displayedBackground}
      onImageError={() => failImage(displayedBackground)}
      data-club-season={preparedAppearance?.season ?? "loading"}
      style={
        {
          backgroundColor: CREAM,
          "--floating-menu-height": `${clubMenuHeight}px`,
          "--floating-stack-height": isOwner
            ? "var(--admin-floating-stack-height)"
            : "44px",
        } as CSSProperties
      }
      fit="cover"
      className={classes.tartanBackground}
    >
      <SafeArea edges={["left", "right"]} className={classes.tartanBackground}>
        {/* Content — banner scrolls with posts, tartan stays fixed behind */}
        <Collection
          windowItems
          ref={listRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          hideScrollbar
          header={
            <>
              {purchaseNotice}
              {ListHeader()}
            </>
          }
          footer={
            posts.length > 0 ? (
              <QueryRetryState
                isLoading={clubQuery.isFetchingNextPage}
                loadingSize="small"
                isError={clubQuery.isFetchNextPageError}
                onRetry={retryPosts}
                message="Не удалось загрузить следующие публикации клуба"
                className={classes.emptyTab}
              >
                {clubQuery.hasNextPage ? (
                  <div className={["ui-stack", classes.emptyTab].join(" ")}>
                    <Action onClick={loadMore} className={classes.action2}>
                      <Typography className={classes.activeFilterChipText}>
                        Загрузить ещё
                      </Typography>
                    </Action>
                  </div>
                ) : null}
              </QueryRetryState>
            ) : null
          }
          empty={
            <QueryRetryState
              loadingContent={
                <Typography
                  role="status"
                  aria-label="Загрузка материалов"
                  aria-busy="true"
                  className={[classes.emptyTab, classes.emptyTabText].join(" ")}
                >
                  Загружаем публикации…
                </Typography>
              }
              isLoading={
                clubQuery.isFetching ||
                (!hasPageError &&
                  (clubQuery.isPending || Boolean(clubQuery.hasNextPage)))
              }
              isError={hasPageError && !backgroundPostError}
              onRetry={retryPosts}
              message="Не удалось загрузить публикации клуба"
            >
              <div className={["ui-stack", classes.emptyTab].join(" ")}>
                <Typography className={classes.emptyTabText}>
                  {activeTab || selectedBoardTag
                    ? "Пока нет публикаций в этом разделе"
                    : "Публикации клуба скоро появятся"}
                </Typography>
              </div>
            </QueryRetryState>
          }
          onLoadMore={active ? loadMore : undefined}
          loadMoreThreshold={2}
          onRefresh={onRefresh}
          contentClassName={classes.postList}
          divider={<div className={classes.postDivider} aria-hidden="true" />}
        />

        {/* Internal Tab Bar */}
        <Background
          role="navigation"
          aria-label="Разделы клуба"
          data-background-notice-menu
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.clubTabBar}
          ref={clubTabsRef}
        >
          {CLUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Action
                aria-pressed={isActive}
                key={tab.id}
                onClick={() => setActiveTab(isActive ? null : tab.id)}
                className={classes.clubTabItem}
              >
                <div
                  className={["ui-stack ", classes.tabStickerContainer]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={{ uri: tab.stickerUri }}
                    contentFit="contain"
                    contentPosition="center bottom"
                    className={[
                      tab.id === "exclusive"
                        ? classes.appearanceState
                        : tab.id === "community"
                          ? classes.appearanceState2
                          : classes.appearanceState3,
                      tab.id === "podborki" ? classes.tabStickerBasket : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </div>
                <Typography
                  className={[
                    classes.clubTabLabelActive,
                    isActive
                      ? classes.appearanceState4
                      : classes.appearanceState5,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {tab.label}
                </Typography>
              </Action>
            );
          })}
        </Background>

        {/* Pen Pals Modal */}
        {showPenPals && penPalsAvailable ? (
          <Dialog
            label="Почтовое отделение"
            open
            motion="slide"
            onClose={() => setShowPenPals(false)}
          >
            <PenPals onClose={() => setShowPenPals(false)} />
          </Dialog>
        ) : null}

        {/* Tag Board Drawer */}
        <TagBoardDrawer
          selectedTag={selectedBoardTag}
          onSelectTag={setSelectedBoardTag}
        />

        {/* Profile setup — local dismissal is not a confirmed server save */}
        {needsProfileSetup ? (
          <Dialog label="Настройка профиля клуба" open motion="slide">
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <Action
                aria-label="Закрыть настройку профиля"
                onClick={() => setSetupHidden(true)}
                className={({ pressed }) =>
                  [
                    classes.action3,
                    pressed ? classes.opacityState3 : classes.opacityState4,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons name="close" size={24} color="#4A3728" />
              </Action>
            </div>
            <ProfileSetup onComplete={() => setSetupHidden(true)} />
          </Dialog>
        ) : null}
      </SafeArea>
      {isOwner && ManagementModals}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
      <ScrollToTopButton scrollRef={listRef} />
      <AdminFAB target="club" />
    </Background>
  );
}
