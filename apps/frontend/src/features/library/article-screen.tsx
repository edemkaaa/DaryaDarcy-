"use client";
import classes from "./article-screen.module.scss";

import {
  Background,
  Action,
  Typography,
  ScrollArea,
} from "@/shared/ui/elements";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { ArticleContent } from "@/domain/content/article-content";
import { trpc } from "@/shared/api/trpc";
import { parseContentId } from "@/shared/navigation/content-id";
import { ContentRequestState } from "@/shared/ui/content-request-state";
import { useClub } from "@/domain/subscription/subscription-context";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import { useClubContentProtection } from "@/shared/browser/use-club-protection";
import type { ArticleBlock } from "@/domain/content/article-blocks";
import { PAPER } from "./article-screen.content";
export default function LibraryArticleScreen({ id }: { id: string }) {
  const router = useRouter();
  const { hasClubAccess } = useClub();
  const articleId = parseContentId(id);
  const utils = trpc.useUtils();
  const input = { id: articleId ?? 0 };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: getQueryKey(trpc.articles.getById, input, "query"),
    // The legacy API uses undefined for missing/unpublished articles. React
    // Query requires a defined success value; normalize absence, not failures.
    queryFn: async ({ signal }) =>
      (await utils.client.articles.getById.query(input, { signal })) ?? null,
    enabled: articleId !== null,
  });
  useClubContentProtection(Boolean(data && !data.locked));
  const [viewer, setViewer] = useState<{
    photos: string[];
    index: number;
  } | null>(null);
  useEffect(() => {
    // Discard the old viewer intent; a later successful retry must not reopen it.
    setViewer(null);
  }, [articleId, error, data?.locked]);
  const blocks = useMemo(
    () => (data?.sections || []) as ArticleBlock[],
    [data],
  );
  const coverUrl = data?.coverUrl;
  const photoUrls = useMemo(
    () => [
      ...new Set([
        ...(coverUrl ? [coverUrl] : []),
        ...blocks.flatMap((block) => {
          if ((block.type === "photo" || block.type === "png") && block.url)
            return [block.url];
          if (block.type === "carousel" && block.urls?.length)
            return block.urls;
          return [];
        }),
      ]),
    ],
    [blocks, coverUrl],
  );
  if (isLoading || error || !data) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <Background source={{ uri: PAPER }} fit="cover" className={classes.bg}>
          <div
            className={["ui-stack ", classes.center].filter(Boolean).join(" ")}
          >
            {isLoading ? (
              <ContentPlaceholder />
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
          <ScrollArea hideScrollbar contentClassName={classes.scroll}>
            {data.coverUrl ? (
              <Picture
                source={{ uri: data.coverUrl }}
                contentFit="cover"
                className={classes.banner}
              />
            ) : null}
            <div
              className={["ui-stack ", classes.pad].filter(Boolean).join(" ")}
            >
              <Typography className={classes.title}>{data.title}</Typography>
              <Typography className={classes.body}>
                Эта статья для участниц клуба Darcy.
              </Typography>
              <Action
                onClick={() => router.push("/club")}
                className={classes.clubBtn}
              >
                <Typography className={classes.clubBtnText}>
                  {hasClubAccess ? "Открыть клуб" : "Вступить в клуб"}
                </Typography>
              </Action>
            </div>
          </ScrollArea>
        </Background>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <Background source={{ uri: PAPER }} fit="cover" className={classes.bg}>
        <ScrollArea hideScrollbar contentClassName={classes.scroll}>
          <ArticleContent
            title={data.title}
            coverUrl={data.coverUrl}
            blocks={blocks}
            onOpenImage={(url) => {
              const photos = photoUrls.includes(url) ? photoUrls : [url];
              setViewer({ photos, index: photos.indexOf(url) });
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
