"use client";
import type { ReactNode } from "react";
import { CursorPagePrevious } from "@/shared/ui/cursor-page-previous";
import { CollectionScrollAnchor } from "@/shared/ui/collection";
import { ScrollArea, Typography, Action } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import type { ArticleCatalogState } from "./use-article-catalog";
import classes from "./articles-admin.module.scss";

type ArticleCatalogProps = {
  catalog: ArticleCatalogState;
  children: ReactNode;
  openingNotice: ReactNode;
  editDisabled: (id: number) => boolean;
  deleteDisabled: boolean;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
};

export function ArticleCatalog({
  catalog,
  children,
  openingNotice,
  editDisabled,
  deleteDisabled,
  onEdit,
  onDelete,
}: ArticleCatalogProps) {
  const { list, scrollRef, lastCardRef } = catalog;
  return (
    <ScrollArea
      ref={scrollRef}
      style={{ overflowAnchor: "none" }}
      contentClassName={classes.list}
      onRefresh={() => void list.restart()}
      refreshing={list.isRefetching && !list.isFetchingNextPage}
    >
      {children}
      <QueryRetryState
        isLoading={list.isLoading}
        isError={
          list.denied ||
          (list.isError &&
            !list.isFetchNextPageError &&
            !list.isFetchPreviousPageError)
        }
        onRetry={() => void list.refetch()}
        message="Не удалось загрузить статьи"
      />
      {openingNotice}
      <CursorPagePrevious query={list} label="Предыдущие статьи" />
      <CollectionScrollAnchor
        trackLayout
        root={scrollRef}
        data={list.items}
        itemKeys={list.items.map((item) => String(item.id))}
      >
        {list.items.map((item, index) => (
          <div
            key={item.id}
            data-item-index={index}
            ref={index === list.items.length - 1 ? lastCardRef : undefined}
            className={["ui-stack ", classes.card].filter(Boolean).join(" ")}
          >
            {item.coverUrl ? (
              <Picture
                source={{ uri: item.coverUrl }}
                contentFit="cover"
                className={classes.cardCover}
              />
            ) : null}
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <Typography className={classes.cardTitle}>
                {item.title}
              </Typography>
              <Typography className={classes.cardMeta}>
                {item.access === "public" ? "Клуб + библиотека" : "Эксклюзив"}
                {item.published ? "" : " · черновик"}
              </Typography>
              <div
                className={["ui-stack ", classes.row].filter(Boolean).join(" ")}
              >
                <Action
                  disabled={editDisabled(item.id)}
                  onClick={() => onEdit(item.id)}
                  className={classes.linkBtn}
                >
                  <Typography className={classes.btnSecondaryText}>
                    Править
                  </Typography>
                </Action>
                <Action
                  disabled={deleteDisabled}
                  onClick={() => onDelete(item.id)}
                  className={classes.linkBtn}
                >
                  <Typography className={classes.typography}>
                    Удалить
                  </Typography>
                </Action>
              </div>
            </div>
          </div>
        ))}
      </CollectionScrollAnchor>
      <QueryRetryState
        isLoading={list.isFetchingNextPage}
        isError={list.isFetchNextPageError}
        loadingSize="small"
        onRetry={() => void list.fetchNextPage()}
        message="Не удалось загрузить следующие статьи"
      />
      {!list.isLoading && !list.isError && !list.items.length ? (
        <Typography className={classes.hint}>
          Пока нет статей — напишите подборку, гид или «обо мне».
        </Typography>
      ) : null}
    </ScrollArea>
  );
}
