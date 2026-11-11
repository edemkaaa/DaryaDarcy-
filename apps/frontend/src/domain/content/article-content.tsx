"use client";
/** Блоки статьи отображаются по типу; открытие фотографий и внешних ссылок передаётся явным пользовательским действиям. */
import { useViewport } from "@/shared/browser/viewport";

import classes from "./article-content.module.scss";
import { Action, Typography, Collection } from "@/shared/ui/elements";

import { openExternalUrl } from "@/shared/browser/actions";
import { safeExternalUrl } from "@/shared/navigation/external-url";
import { useState } from "react";
import { Picture } from "@/shared/media/image";
import {
  parseArticleInlines,
  type ArticleBlock,
} from "@/domain/content/article-blocks";

/** Отображаем переданные блоки и обложку без исполнения HTML; открытие изображений делегируем владельцу просмотра. */
export function ArticleContent({
  title,
  coverUrl,
  blocks,
  onOpenImage,
}: {
  title: string;
  coverUrl?: string | null;
  blocks: ArticleBlock[];
  onOpenImage?: (url: string) => void;
}) {
  return (
    <div className="ui-stack ">
      {coverUrl ? (
        <Action
          aria-label="Открыть обложку статьи"
          onClick={() => (onOpenImage ? onOpenImage(coverUrl) : undefined)}
          disabled={!onOpenImage}
        >
          <Picture
            source={{ uri: coverUrl }}
            loading="eager"
            contentFit="cover"
            className={classes.banner}
          />
        </Action>
      ) : null}
      <div className={["ui-stack ", classes.pad].filter(Boolean).join(" ")}>
        <Typography className={classes.title}>
          {title || "Без названия"}
        </Typography>
        <Typography className={classes.byline}>· daryadarcy ·</Typography>
        {blocks.map((block, index) => (
          <ArticleBlockView
            key={`${block.type}-${index}`}
            block={block}
            onOpenImage={onOpenImage}
          />
        ))}
      </div>
    </div>
  );
}
/** Выбираем разметку по типу блока: текстовые inlines, отдельные изображения, внешнее действие или карусель; размеры фото уточняются onLoad. */
function ArticleBlockView({
  block,
  onOpenImage,
}: {
  block: ArticleBlock;
  onOpenImage?: (url: string) => void;
}) {
  const viewport = useViewport();

  const { width: SCREEN_WIDTH } = viewport;
  const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH * 0.58;
  const CAROUSEL_ITEM_HEIGHT = CAROUSEL_ITEM_WIDTH * (5 / 4);
  const stylesLayout = {
    carouselItem: {
      width: CAROUSEL_ITEM_WIDTH,
      height: CAROUSEL_ITEM_HEIGHT,
    },
  };

  const [ratio, setRatio] = useState(block.type === "png" ? 1.15 : 1.6);
  if (block.type === "heading" && block.text?.trim()) {
    return (
      <Typography className={classes.heading}>{block.text.trim()}</Typography>
    );
  }
  if (block.type === "text" && block.text?.trim()) {
    return (
      <>
        {block.text.split(/\n{2,}/).map((paragraph, index) => (
          <Typography key={index} className={classes.body}>
            {parseArticleInlines(paragraph.trim()).map((part, i) => {
              if (part.kind === "link") {
                return (
                  <a
                    key={i}
                    href={safeExternalUrl(part.url) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={["ui-inline-link", classes.inlineLink]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {part.text}
                  </a>
                );
              }
              if (part.kind === "bold") {
                return (
                  <Typography key={i} className={classes.bold}>
                    {part.text}
                  </Typography>
                );
              }
              return <Typography key={i}>{part.text}</Typography>;
            })}
          </Typography>
        ))}
      </>
    );
  }
  if ((block.type === "photo" || block.type === "png") && block.url) {
    const png = block.type === "png";
    const gif = /\.gif(\?|$)/i.test(block.url);
    const caption = block.caption?.trim();
    const image = (
      <Picture
        source={{ uri: block.url }}
        style={{
          ...((png ? false : true)
            ? { borderRadius: png ? undefined : 6 }
            : {}),
          aspectRatio: ratio,
        }}
        contentFit={png || gif ? "contain" : "cover"}
        onLoad={(event) => {
          const width = event.source?.width;
          const height = event.source?.height;
          if (width && height) setRatio(width / height);
        }}
        className={png ? classes.appearanceState : classes.appearanceState2}
      />
    );
    const media = onOpenImage ? (
      <Action
        aria-label="Открыть изображение статьи"
        onClick={() => onOpenImage(block.url!)}
        style={{
          ...((png ? true : false)
            ? { alignItems: png ? "center" : undefined }
            : {}),
        }}
      >
        {image}
      </Action>
    ) : png ? (
      <div className={["ui-stack ", classes.pngWrap].filter(Boolean).join(" ")}>
        {image}
      </div>
    ) : (
      image
    );
    return (
      <div
        className={["ui-stack ", classes.mediaBlock].filter(Boolean).join(" ")}
      >
        {media}
        {caption ? (
          <Typography className={classes.caption}>{caption}</Typography>
        ) : null}
      </div>
    );
  }
  if (block.type === "link" && block.url) {
    return (
      <Action
        onClick={() => void openExternalUrl(block.url!)}
        className={classes.linkBtn}
      >
        <Typography className={classes.linkBtnText}>
          {block.label || block.url}
        </Typography>
      </Action>
    );
  }
  if (block.type === "carousel" && block.urls?.length) {
    const caption = block.caption?.trim();
    return (
      <div
        className={["ui-stack ", classes.mediaBlock].filter(Boolean).join(" ")}
      >
        <div
          className={["ui-stack ", classes.carouselWrap]
            .filter(Boolean)
            .join(" ")}
        >
          <Collection
            data={block.urls}
            horizontal
            hideScrollbar
            keyExtractor={(url, index) => `${url}-${index}`}
            renderItem={({ item }) => (
              <Action
                aria-label="Открыть изображение статьи"
                onClick={() => onOpenImage?.(item)}
                style={{
                  width: stylesLayout.carouselItem.width,
                  height: stylesLayout.carouselItem.height,
                }}
                disabled={!onOpenImage}
                className={classes.carouselItem}
              >
                <Picture
                  source={{ uri: item }}
                  contentFit="cover"
                  className={classes.carouselImage}
                  sizes="(max-width: 480px) 58vw, 278.4px"
                />
              </Action>
            )}
            contentClassName={classes.carouselList}
          />
        </div>
        {caption ? (
          <Typography className={classes.caption}>{caption}</Typography>
        ) : null}
      </div>
    );
  }
  return null;
}
