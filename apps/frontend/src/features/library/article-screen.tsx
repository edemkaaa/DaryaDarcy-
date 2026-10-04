"use client";
import classes from "./article-screen.module.scss";

import {
  Background,
  Action,
  Typography,
  Spinner,
  ScrollArea,
} from "@/shared/ui/elements";
import { useMemo, useState } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ArticleContent } from "@/domain/content/article-content";
import { trpc } from "@/shared/api/trpc";
import { parseContentId } from "@/shared/navigation/content-id";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { useClub } from "@/domain/subscription/subscription-context";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import { useClubContentProtection } from "@/shared/browser/use-club-protection";
import type { ArticleBlock } from "@/domain/content/article-blocks";
import { PAPER, BROWN_MUTED } from "./article-screen.content";
export default function LibraryArticleScreen({ id }: { id: string }) {
  const router = useRouter();
  const { isSubscribed } = useClub();
  const articleId = parseContentId(id);
  const { data, isLoading, error, refetch } = trpc.articles.getById.useQuery(
    { id: articleId ?? 0 },
    { enabled: articleId !== null },
  );
  useClubContentProtection(Boolean(data && !data.locked));
  const [viewer, setViewer] = useState<{
    photos: string[];
    index: number;
  } | null>(null);
  const blocks = useMemo(
    () => (data?.sections || []) as ArticleBlock[],
    [data],
  );
  const photoUrls = useMemo(
    () =>
      blocks.flatMap((block) => {
        if ((block.type === "photo" || block.type === "png") && block.url)
          return [block.url];
        if (block.type === "carousel" && block.urls?.length) return block.urls;
        return [];
      }),
    [blocks],
  );
  if (isLoading || !data) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background source={{ uri: PAPER }} fit="cover" className={classes.bg}>
          <Action onClick={() => router.back()} className={classes.back}>
            <Typography className={classes.backText}>← Назад</Typography>
          </Action>
          <div
            className={["ui-stack ", classes.center].filter(Boolean).join(" ")}
          >
            {isLoading ? (
              <Spinner color={BROWN_MUTED} />
            ) : (
              <ContentRequestState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                notFoundText="Статья не найдена"
              />
            )}
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  if (data.locked) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background source={{ uri: PAPER }} fit="cover" className={classes.bg}>
          <Action onClick={() => router.back()} className={classes.back}>
            <Typography className={classes.backText}>← Назад</Typography>
          </Action>
          {data.coverUrl ? (
            <Picture
              source={{ uri: data.coverUrl }}
              contentFit="cover"
              className={classes.banner}
            />
          ) : null}
          <div className={["ui-stack ", classes.pad].filter(Boolean).join(" ")}>
            <Typography className={classes.title}>{data.title}</Typography>
            <Typography className={classes.body}>
              Эта статья для участниц клуба Darcy.
            </Typography>
            <Action
              onClick={() => router.push("/club")}
              className={classes.clubBtn}
            >
              <Typography className={classes.clubBtnText}>
                {isSubscribed ? "Открыть клуб" : "Вступить в клуб"}
              </Typography>
            </Action>
          </div>
        </Background>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Background source={{ uri: PAPER }} fit="cover" className={classes.bg}>
        <ScrollArea hideScrollbar contentClassName={classes.scroll}>
          <Action onClick={() => router.back()} className={classes.back}>
            <Typography className={classes.backText}>← Назад</Typography>
          </Action>
          <ArticleContent
            title={data.title}
            coverUrl={data.coverUrl}
            blocks={blocks}
            onOpenImage={(url) => {
              const photos = photoUrls.length ? photoUrls : [url];
              setViewer({ photos, index: Math.max(0, photos.indexOf(url)) });
            }}
          />
        </ScrollArea>
        {viewer ? (
          <PhotoViewer
            photos={viewer.photos}
            initialIndex={viewer.index}
            visible
            onClose={() => setViewer(null)}
          />
        ) : null}
      </Background>
    </ScreenContainer>
  );
}
