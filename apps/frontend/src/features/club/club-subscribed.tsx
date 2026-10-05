"use client";
import { useViewport } from "@/shared/browser/viewport";
import { TabHeader } from "@/shared/ui/tab-header";
import { CLUB_MUSIC_URL } from "@/shared/styles/tab-assets";

import { getClubSubscribedLayout } from "./club-subscribed.layout";
import classes from "./club-subscribed.module.scss";
import {
  type ScrollEvent,
  Typography,
  Action,
  Background,
  Collection,
  Dialog,
} from "@/shared/ui/elements";
import { ClubPostCard } from "./club-post-card";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/domain/session/session-context";
import AsyncStorage from "@/shared/browser/storage";
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
import {
  displayPostTitle,
  isRawMediaFilename,
} from "@/shared/media/media-label";
import { postMatchesClubTab } from "@/domain/post/club-tags";
import { postHasTag } from "@/domain/post/post-tags";
import {
  sanitizePlainPostText,
  sanitizeRichTextForDisplay,
} from "@/domain/content/post-text-sanitize";
import { postDisplayDate } from "@/domain/post/post-date";
import { articleIdFromSource } from "@/domain/content/article-blocks";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import { useClubContentProtection } from "@/shared/browser/use-club-protection";
import {
  CLUB_PROFILE_AVATAR_KEY,
  CLUB_PROFILE_GENDER_KEY,
  CLUB_PROFILE_NAME_KEY,
  syncClubProfileToServer,
} from "@/domain/profile/sync-profile";
import {
  PAPER_TEXTURE_URI,
  SEASONAL_TARTANS,
  SEASONAL_BANNERS,
  CLUB_TABS,
  MAILBOX_URI,
  PROFILE_COMPLETED_KEY,
} from "./club-subscribed.content";
import type { ClubTab, ClubPost } from "./club-subscribed.content";
function getClubSeason(): "autumn" | "winter" {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  // Winter: Nov 20 onwards through Feb
  if (
    (month === 10 && day >= 20) ||
    month === 11 ||
    month === 0 ||
    month === 1 ||
    (month === 2 && day <= 19)
  ) {
    return "winter";
  }
  return "autumn";
}
export function ClubSubscribed() {
  const capabilities = useCapabilities();
  const viewport = useViewport();
  const { stylesLayout } = getClubSubscribedLayout(viewport);

  const [activeTab, setActiveTab] = useState<ClubTab | null>(null);
  const [showPenPals, setShowPenPals] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(
    null,
  ); // reserved for manual trigger if needed
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileGender, setProfileGender] = useState<"female" | "male" | null>(
    null,
  );
  const [selectedBoardTag, setSelectedBoardTag] = useState<string | null>(null);
  const { user, refresh, isOwner } = useAuth();
  useClubContentProtection(true);
  const utils = trpc.useUtils();
  const updateProfile = trpc.profile.update.useMutation();
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation();
  const interactions = usePostInteractions();
  const pushProfileToServer = useCallback(async () => {
    if (!user) return;
    await syncClubProfileToServer(
      {
        updateProfile: (input) => updateProfile.mutateAsync(input),
        uploadAvatar: (input) => uploadAvatar.mutateAsync(input),
      },
      { userId: user.id, currentAvatarUrl: user.avatarUrl },
    );
    await refresh();
    void utils.club.comments.invalidate();
  }, [user, updateProfile, uploadAvatar, refresh, utils.club.comments]);
  // Admin post management (edit/delete)
  const onRefresh = () => {
    utils.club.list.invalidate();
  };
  const { openMenu, ManagementModals } = usePostManagement(onRefresh);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const handleListScroll = useCallback((event: ScrollEvent) => {
    setShowScrollTop(event.currentTarget.scrollTop > 360);
  }, []);
  const scrollClubToTop = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openPhotoViewer = (photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };
  // Check if profile has been completed (stored locally)
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PROFILE_COMPLETED_KEY),
      AsyncStorage.getItem(CLUB_PROFILE_NAME_KEY),
      AsyncStorage.getItem(CLUB_PROFILE_GENDER_KEY),
    ]).then(([completed, name, gender]) => {
      // Consider profile completed if flag is set OR if name already exists
      const isCompleted =
        completed === "true" || (name != null && name.length > 0);
      setProfileCompleted(isCompleted);
      // If name exists but flag wasn't set, fix it for next time
      if (!completed && name) {
        AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
      }
      if (name) setProfileName(name);
      if (gender === "female" || gender === "male") setProfileGender(gender);
    });
  }, []);
  const profileSyncUserRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    if (profileSyncUserRef.current === user.id) return;
    profileSyncUserRef.current = user.id;
    const hasServerAvatar =
      user.avatarUrl && /^https?:\/\//.test(user.avatarUrl);
    if (hasServerAvatar) return;
    void pushProfileToServer().catch(() => {});
  }, [user, pushProfileToServer]);
  const handleClubLike = (postId: string) => interactions.like(Number(postId));
  const handleClubSave = (postId: string) => interactions.save(Number(postId));
  // Show profile setup if profile is not yet completed (only after loading finishes)
  // profileCompleted: null = still loading, true = done, false = needs setup
  // Never show for owner/admin
  const needsProfileSetup = profileCompleted === false && !isOwner;
  // Use local profile data for greeting (fallback to user from auth)
  const displayName = profileName || user?.name;
  const displayGender = profileGender || user?.gender;
  // Fetch club posts from DB
  const clubQuery = trpc.club.list.useQuery(
    { limit: 200 },
    { refetchOnWindowFocus: false },
  );
  // Convert API posts to the club presentation model.
  const dbPosts: ClubPost[] = (clubQuery.data?.posts || [])
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
  const allPosts = dbPosts;
  const tabPosts = activeTab
    ? allPosts.filter((post) => postMatchesClubTab(post.tags, activeTab))
    : allPosts;
  const posts = selectedBoardTag
    ? tabPosts.filter((p) => postHasTag(p.tags, selectedBoardTag))
    : tabPosts;
  const season = getClubSeason();
  const tartanUri = SEASONAL_TARTANS[season];
  const bannerUri = SEASONAL_BANNERS[season];
  const renderPost = ({ item }: { item: ClubPost }) => (
    <ClubPostCard
      item={item}
      isSaved={interactions.savedIds.has(Number(item.id))}
      isLiked={interactions.likedIds.has(Number(item.id))}
      likePending={
        !interactions.ready || interactions.isPending("like", Number(item.id))
      }
      savePending={
        !interactions.ready || interactions.isPending("save", Number(item.id))
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
                target: "club",
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
      {bannerUri ? (
        <div
          style={{
            width: stylesLayout.bannerContainer.width,
            height: stylesLayout.bannerContainer.height,
          }}
          className={["ui-stack ", classes.bannerContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <Picture
            source={{ uri: bannerUri }}
            contentFit="cover"
            contentPosition="top"
            className={classes.bannerImage}
          />
        </div>
      ) : null}
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
      {activeTab === "community" && capabilities.penPals ? (
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
      source={{ uri: tartanUri }}
      fit="cover"
      className={classes.tartanBackground}
    >
      <SafeArea edges={["left", "right"]} className={classes.tartanBackground}>
        <TabHeader musicUrl={CLUB_MUSIC_URL} />
        {/* Content — banner scrolls with posts, tartan stays fixed behind */}
        <Collection
          ref={listRef}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          hideScrollbar
          header={ListHeader()}
          empty={
            <QueryRetryState
              isLoading={clubQuery.isPending}
              isError={clubQuery.isError}
              onRetry={() => void clubQuery.refetch()}
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
          onScroll={handleListScroll}
          contentClassName={classes.postList}
        />

        {/* Internal Tab Bar */}
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.clubTabBar}
        >
          {CLUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Action
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
                    className={
                      tab.id === "exclusive"
                        ? classes.appearanceState
                        : tab.id === "community"
                          ? classes.appearanceState2
                          : classes.appearanceState3
                    }
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
        {showPenPals && capabilities.penPals ? (
          <Dialog open motion="slide">
            <PenPals onClose={() => setShowPenPals(false)} />
          </Dialog>
        ) : null}

        {/* Tag Board Drawer */}
        <TagBoardDrawer
          selectedTag={selectedBoardTag}
          onSelectTag={setSelectedBoardTag}
        />

        {/* Profile Setup Modal — shown only once for new users who haven't set up profile */}
        {needsProfileSetup ? (
          <Dialog open motion="slide">
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <Action
                onClick={async () => {
                  await AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
                  setProfileCompleted(true);
                }}
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
            <ProfileSetup
              onComplete={async (data) => {
                await AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
                await AsyncStorage.setItem(CLUB_PROFILE_NAME_KEY, data.name);
                await AsyncStorage.setItem(
                  CLUB_PROFILE_GENDER_KEY,
                  data.gender,
                );
                if (data.avatarUrl) {
                  await AsyncStorage.setItem(
                    CLUB_PROFILE_AVATAR_KEY,
                    data.avatarUrl,
                  );
                }
                setProfileCompleted(true);
                setProfileName(data.name);
                setProfileGender(data.gender);
                if (user) {
                  await pushProfileToServer();
                } else {
                  await refresh();
                }
              }}
            />
          </Dialog>
        ) : null}
      </SafeArea>
      {isOwner && <ManagementModals />}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
      <ScrollToTopButton
        visible={showScrollTop}
        onClick={scrollClubToTop}
        bottom={120}
      />
      <AdminFAB target="club" />
    </Background>
  );
}
