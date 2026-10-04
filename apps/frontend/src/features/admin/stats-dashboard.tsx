"use client";
import classes from "./stats-dashboard.module.scss";
import { Action, Spinner, Typography, ScrollArea } from "@/shared/ui/elements";
import { useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";
import { BROWN_LIGHT, ACCENT } from "./stats-dashboard.content";
export function StatsDashboard() {
  const {
    data: stats,
    isLoading,
    refetch,
  } = trpc.admin.stats.useQuery(undefined, {});
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  if (isLoading) {
    return (
      <div
        className={["ui-stack ", classes.loadingContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <Spinner size="large" color={ACCENT} />
        <Typography className={classes.loadingText}>
          Загрузка статистики...
        </Typography>
      </div>
    );
  }
  if (!stats) {
    return (
      <div
        className={["ui-stack ", classes.loadingContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <MaterialIcons name="error-outline" size={32} color={BROWN_LIGHT} />
        <Typography className={classes.loadingText}>
          Не удалось загрузить статистику
        </Typography>
        <Action onClick={() => void refetch()}>Повторить</Action>
      </div>
    );
  }
  const monthDiff =
    stats.postsLastMonth > 0
      ? Math.round(
          ((stats.postsThisMonth - stats.postsLastMonth) /
            stats.postsLastMonth) *
            100,
        )
      : stats.postsThisMonth > 0
        ? 100
        : 0;
  return (
    <ScrollArea
      refreshing={refreshing}
      onRefresh={onRefresh}
      className={classes.scrollArea}
      contentClassName={classes.container}
    >
      {/* Overview Cards */}
      <Typography className={classes.sectionTitle}>Обзор</Typography>
      <div
        className={["ui-stack ", classes.cardsRow].filter(Boolean).join(" ")}
      >
        <div className={["ui-stack ", classes.card].filter(Boolean).join(" ")}>
          <MaterialIcons name="article" size={24} color={ACCENT} />
          <Typography className={classes.cardNumber}>
            {stats.totalPosts}
          </Typography>
          <Typography className={classes.cardLabel}>Всего постов</Typography>
        </div>
        <div className={["ui-stack ", classes.card].filter(Boolean).join(" ")}>
          <MaterialIcons name="favorite" size={24} color="#E57373" />
          <Typography className={classes.cardNumber}>
            {stats.totalLikes}
          </Typography>
          <Typography className={classes.cardLabel}>Лайков</Typography>
        </div>
        <div className={["ui-stack ", classes.card].filter(Boolean).join(" ")}>
          <MaterialIcons name="bookmark" size={24} color="#FFB74D" />
          <Typography className={classes.cardNumber}>
            {stats.totalSaves}
          </Typography>
          <Typography className={classes.cardLabel}>Сохранений</Typography>
        </div>
      </div>

      {/* Status Breakdown */}
      <Typography className={classes.sectionTitle}>По статусу</Typography>
      <div
        className={["ui-stack ", classes.breakdownCard]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
          />
          <Typography className={classes.breakdownLabel}>
            Опубликовано
          </Typography>
          <Typography className={classes.breakdownValue}>
            {stats.publishedPosts}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
          <Typography className={classes.breakdownLabel}>
            Запланировано
          </Typography>
          <Typography className={classes.breakdownValue}>
            {stats.scheduledPosts}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
          />
          <Typography className={classes.breakdownLabel}>Черновики</Typography>
          <Typography className={classes.breakdownValue}>
            {stats.draftPosts}
          </Typography>
        </div>
      </div>

      {/* Target Breakdown */}
      <Typography className={classes.sectionTitle}>По каналу</Typography>
      <div
        className={["ui-stack ", classes.breakdownCard]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="dynamic-feed" size={16} color={ACCENT} />
          <Typography className={classes.breakdownLabel}>Лента</Typography>
          <Typography className={classes.breakdownValue}>
            {stats.feedPosts}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="groups" size={16} color={ACCENT} />
          <Typography className={classes.breakdownLabel}>Клуб</Typography>
          <Typography className={classes.breakdownValue}>
            {stats.clubPosts}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="merge-type" size={16} color={ACCENT} />
          <Typography className={classes.breakdownLabel}>Оба</Typography>
          <Typography className={classes.breakdownValue}>
            {stats.bothPosts}
          </Typography>
        </div>
      </div>

      {/* Monthly Activity */}
      <Typography className={classes.sectionTitle}>Активность</Typography>
      <div
        className={["ui-stack ", classes.breakdownCard]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="today" size={16} color={ACCENT} />
          <Typography className={classes.breakdownLabel}>Этот месяц</Typography>
          <Typography className={classes.breakdownValue}>
            {stats.postsThisMonth}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons name="event" size={16} color={BROWN_LIGHT} />
          <Typography className={classes.breakdownLabel}>
            Прошлый месяц
          </Typography>
          <Typography className={classes.breakdownValue}>
            {stats.postsLastMonth}
          </Typography>
        </div>
        <div
          className={["ui-stack ", classes.breakdownRow]
            .filter(Boolean)
            .join(" ")}
        >
          <MaterialIcons
            name={monthDiff >= 0 ? "trending-up" : "trending-down"}
            size={16}
            color={monthDiff >= 0 ? "#4CAF50" : "#E57373"}
          />
          <Typography className={classes.breakdownLabel}>Динамика</Typography>
          <Typography
            className={[
              classes.typography,
              monthDiff >= 0 ? classes.colorState : classes.colorState2,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {monthDiff >= 0 ? "+" : ""}
            {monthDiff}%
          </Typography>
        </div>
      </div>

      {/* Top Liked Posts */}
      {stats.topLikedPosts.length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Топ по лайкам
          </Typography>
          <div
            className={["ui-stack ", classes.breakdownCard]
              .filter(Boolean)
              .join(" ")}
          >
            {stats.topLikedPosts.map((post, i) => (
              <div
                key={post.id}
                className={[
                  ["ui-stack ", classes.breakdownRow].filter(Boolean).join(" "),
                  i > 0 ? classes.borderTopWidthState : "",
                  i > 0 ? classes.borderTopColorState : "",
                  i > 0 ? classes.paddingTopState : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.rankNumber}>#{i + 1}</Typography>
                <Typography lines={1} className={classes.topPostText}>
                  {post.text || "Без текста"}
                </Typography>
                <div
                  className={["ui-stack ", classes.likesBadge]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons name="favorite" size={12} color="#E57373" />
                  <Typography className={classes.likesCount}>
                    {post.likeCount}
                  </Typography>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={["ui-stack ", classes.div4].filter(Boolean).join(" ")} />
    </ScrollArea>
  );
}
