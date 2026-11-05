"use client";
import { useBrowserReady } from "@/shared/browser/use-browser-ready";

import classes from "./post-screen.module.scss";
import { useQuery } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { getHttpStatus } from "@/shared/api/errors";
import { useEffect, useState } from "react";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import {
  Background,
  Action,
  Typography,
  ScrollArea,
} from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { useRouter } from "@/shared/navigation/router";
import { usePostInteractions } from "@/domain/post/use-post-interactions";
import { PostInteractionStatus } from "@/domain/post/post-interaction-status";
import { ClubComments } from "@/features/club/club-comments";
import { trpc } from "@/shared/api/trpc";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { parsePostAddress, postHref } from "@/shared/navigation/post-address";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { useAuth } from "@/domain/session/session-context";
import { RichTextRenderer } from "@/domain/content/rich-text-renderer";
import { resolvePostVideos } from "@/domain/post/resolve-post-video";
import { PostMediaSection } from "@/shared/media/post-media-section";
import { NaturalPhotoStack } from "@/shared/media/natural-photo-stack";
import { useClubContentProtection } from "@/shared/browser/use-club-protection";
import { postTagLabel } from "@/domain/post/post-tags";
import { postDisplayDate } from "@/domain/post/post-date";
import { ScreenErrorBoundary } from "@/shared/ui/screen-error-boundary";
import {
  PAPER_TEXTURE_URI,
  BROWN_LIGHT,
  GREEN_ACCENT,
} from "./post-screen.content";
function formatDate(date: Date | string, browserCalendar: boolean): string {
  const d = new Date(date);
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  return `${browserCalendar ? d.getDate() : d.getUTCDate()} ${months[browserCalendar ? d.getMonth() : d.getUTCMonth()]} ${browserCalendar ? d.getFullYear() : d.getUTCFullYear()}`;
}
function PostDetailScreenInner({ id }: { id: string }) {
  const active = useScreenActive();
  const browserCalendar = useBrowserReady();

  const router = useRouter();
  const { user } = useAuth();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const utils = trpc.useUtils();
  const input = parsePostAddress(id);
  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: getQueryKey(trpc.feed.getById, input ?? undefined, "query"),
    // Missing/hidden posts are successful absence, never a stale cached copy.
    queryFn: async ({ signal }) =>
      input ? (await utils.client.feed.getById.query(input, { signal })) ?? null : null,
    ...contentRefreshOptions(active && input !== null),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const denied = [401, 403, 404].includes(getHttpStatus(error) ?? 0);
  const unavailable = !post || denied;
  const postId = post?.id ?? 0;
  const interactions = usePostInteractions(unavailable ? [] : [postId]);
  const isLiked = interactions.likedIds.has(postId);
  const isSaved = interactions.savedIds.has(postId);
  useBackgroundNotice({
    when: Boolean(error && !unavailable),
    message: "Не удалось обновить публикацию",
    onRetry: () => refetch({ cancelRefetch: false }),
  });
  useEffect(() => {
    setViewerVisible(false);
  }, [id, unavailable]);
  useClubContentProtection(
    Boolean(post && (post.target === "club" || post.target === "both")),
  );
  const handleLike = () => {
    if (!user) {
      router.login(postHref({ id: postId, publicId: post?.publicId }));
      return;
    }
    interactions.like(postId);
  };
  const handleSave = () => {
    if (!user) {
      router.login(postHref({ id: postId, publicId: post?.publicId }));
      return;
    }
    interactions.save(postId);
  };
  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <div
            className={["ui-stack ", classes.loadingContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <ContentPlaceholder />
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  if (!post || denied) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <div
            className={["ui-stack ", classes.loadingContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <ContentRequestState
              error={error}
              onRetry={() => {
                void refetch();
              }}
              notFoundText="Пост не найден"
            />
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  const photos = post.photos || [];
  const tags = post.tags || [];
  const media = post.media || [];
  const resolved = resolvePostVideos(photos, media);
  const viewPhotos = resolved.stackPhotos;
  const hasVideo = resolved.videos.length > 0;
  const isClubPost = post.target === "club" || post.target === "both";
  const tagLabels = tags.map((slug) => postTagLabel(slug)).filter(Boolean);
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea
          hideScrollbar
          className={classes.background}
          contentClassName={classes.scrollContent}
        >
          {(hasVideo || viewPhotos.length > 0) && (
            <div
              className={["ui-stack ", classes.photoSection]
                .filter(Boolean)
                .join(" ")}
            >
              <NaturalPhotoStack
                photos={viewPhotos}
                onPhotoPress={(index) => {
                  setViewerIndex(index);
                  setViewerVisible(true);
                }}
                videos={resolved.videos}
              />
            </div>
          )}

          {media.filter((item) => item.type !== "video").length > 0 ? (
            <div
              className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
            >
              <PostMediaSection
                media={media.filter((item) => item.type !== "video")}
              />
            </div>
          ) : null}

          {/* Post Content */}
          <div
            className={["ui-stack ", classes.contentSection]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Full text */}
            <RichTextRenderer
              richText={post.richText}
              plainText={post.text}
              selectable={!isClubPost}
              textClassName={classes.postText}
            />

            <ClubComments
              postId={postId}
              tags={tags}
              createdAt={post.publishedAt ?? post.createdAt}
            />

            {/* Tags */}
            {tagLabels.length > 0 && (
              <div
                className={["ui-stack ", classes.tagsRow]
                  .filter(Boolean)
                  .join(" ")}
              >
                {tagLabels.map((label, i) => (
                  <div
                    key={i}
                    className={["ui-stack ", classes.tag]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.tagText}>
                      #{label}
                    </Typography>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div
              className={["ui-stack ", classes.footer]
                .filter(Boolean)
                .join(" ")}
            >
              <PostInteractionStatus
                error={interactions.error}
                retry={interactions.retry}
              />
              <Typography className={classes.dateText}>
                {(() => {
                  const d = postDisplayDate(post);
                  return d ? formatDate(d, browserCalendar) : "";
                })()}
              </Typography>
              <div
                className={["ui-stack ", classes.actions]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={handleLike}
                  aria-label="Нравится"
                  aria-pressed={isLiked}
                  disabled={
                    Boolean(user) &&
                    (!interactions.isReady(postId) ||
                      interactions.isPending("like", postId))
                  }
                  className={({ pressed }) =>
                    [
                      classes.action2,
                      pressed ? classes.opacityState7 : classes.opacityState8,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <MaterialIcons
                    name={isLiked ? "favorite" : "favorite-border"}
                    size={22}
                    color={isLiked ? "#A85C5C" : BROWN_LIGHT}
                  />
                  <Typography
                    className={[
                      classes.typography,
                      isLiked ? classes.colorState : classes.colorState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {post.likeCount ?? 0}
                  </Typography>
                </Action>
                <Action
                  onClick={handleSave}
                  aria-label="Сохранить пост"
                  aria-pressed={isSaved}
                  disabled={
                    Boolean(user) &&
                    (!interactions.isReady(postId) ||
                      interactions.isPending("save", postId))
                  }
                  className={({ pressed }) =>
                    [
                      classes.action2,
                      pressed ? classes.opacityState9 : classes.opacityState10,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <MaterialIcons
                    name={isSaved ? "bookmark" : "bookmark-border"}
                    size={22}
                    color={isSaved ? GREEN_ACCENT : BROWN_LIGHT}
                  />
                </Action>
              </div>
            </div>
          </div>
        </ScrollArea>
      </Background>
      <PhotoViewer
        visible={viewerVisible}
        photos={viewPhotos}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </ScreenContainer>
  );
}
export default function PostDetailScreen({ id }: { id: string }) {
  return (
    <ScreenErrorBoundary message="Не удалось открыть пост">
      <PostDetailScreenInner id={id} />
    </ScreenErrorBoundary>
  );
}
