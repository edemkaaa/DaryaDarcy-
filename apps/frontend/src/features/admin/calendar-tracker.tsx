"use client";
import classes from "./calendar-tracker.module.scss";
import { Action, Typography } from "@/shared/ui/elements";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { useState, useMemo } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import type { AdminPost } from "@/shared/api/types";
import {
  BROWN_DARK,
  BROWN_LIGHT,
  ACCENT,
  OLIVE,
  WEEKDAYS,
  MONTHS_RU,
} from "./calendar-tracker.content";
type ScheduledPost = AdminPost;
interface CalendarTrackerProps {
  posts: AdminPost[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onPostPress?: (post: ScheduledPost) => void;
  onDayPress?: (date: Date) => void;
}
export function CalendarTracker({
  posts: allPosts,
  isLoading,
  isError,
  onRetry,
  onPostPress,
  onDayPress,
}: CalendarTrackerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const postsByDay = useMemo(() => {
    const byMonth = new Map<string, Map<number, ScheduledPost[]>>();
    if (!allPosts) return byMonth;
    allPosts.forEach((post) => {
      const dateStr = post.scheduledAt || post.publishedAt || post.createdAt;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!byMonth.has(key)) byMonth.set(key, new Map());
      const map = byMonth.get(key)!;
      const day = date.getDate();
      const existing = map.get(day) || [];
      existing.push(post as ScheduledPost);
      map.set(day, existing);
    });
    return byMonth;
  }, [allPosts]);
  const upcoming = useMemo(() => {
    if (!allPosts) return [] as ScheduledPost[];
    return (allPosts as ScheduledPost[])
      .filter((post) => post.status === "scheduled" && post.scheduledAt)
      .sort(
        (a, b) =>
          new Date(a.scheduledAt || 0).getTime() -
          new Date(b.scheduledAt || 0).getTime(),
      )
      .slice(0, 8);
  }, [allPosts]);
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return OLIVE;
      case "scheduled":
        return ACCENT;
      case "draft":
        return BROWN_LIGHT;
      default:
        return BROWN_LIGHT;
    }
  };
  const monthStats = (y: number, m: number) => {
    const map = postsByDay.get(`${y}-${m}`) || new Map();
    const posts = [...map.values()].flat();
    return {
      published: posts.filter((post) => post.status === "published").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      draft: posts.filter((post) => post.status === "draft").length,
    };
  };
  if (isError)
    return (
      <QueryRetryState
        isLoading={false}
        isError
        onRetry={onRetry}
        message="Не удалось загрузить календарь публикаций"
      />
    );
  if (isLoading) {
    return (
      <div
        className={["ui-stack ", classes.loadingContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <ContentPlaceholder />
      </div>
    );
  }
  const monthsToShow = [0, 1].map((offset) => {
    const date = new Date(year, month + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  return (
    <div className={["ui-stack ", classes.container].filter(Boolean).join(" ")}>
      <div
        className={["ui-stack ", classes.monthHeader].filter(Boolean).join(" ")}
      >
        <Action
          aria-label="Предыдущий месяц"
          onClick={goToPrevMonth}
          className={({ pressed }) =>
            [
              classes.action,
              pressed ? classes.opacityState : classes.opacityState2,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="chevron-left" size={24} color={BROWN_DARK} />
        </Action>
        <Typography className={classes.monthTitle}>
          {MONTHS_RU[month]} — {MONTHS_RU[monthsToShow[1].month]}{" "}
          {monthsToShow[1].year}
        </Typography>
        <Action
          aria-label="Следующий месяц"
          onClick={goToNextMonth}
          className={({ pressed }) =>
            [
              classes.action,
              pressed ? classes.opacityState3 : classes.opacityState4,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="chevron-right" size={24} color={BROWN_DARK} />
        </Action>
      </div>

      {monthsToShow.map((item) => (
        <MonthGrid
          key={`${item.year}-${item.month}`}
          year={item.year}
          month={item.month}
          postsByDay={postsByDay.get(`${item.year}-${item.month}`) || new Map()}
          stats={monthStats(item.year, item.month)}
          getStatusColor={getStatusColor}
          onPostPress={onPostPress}
          onDayPress={onDayPress}
        />
      ))}

      {upcoming.length > 0 ? (
        <div
          className={["ui-stack ", classes.upcoming].filter(Boolean).join(" ")}
        >
          <Typography className={classes.upcomingTitle}>
            Отложенные публикации
          </Typography>
          {upcoming.map((post) => (
            <Action
              key={post.id}
              onClick={() => onPostPress?.(post)}
              className={({ pressed }) =>
                [classes.action2, pressed ? classes.opacityState5 : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <div
                className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
              />
              <Typography className={classes.upcomingDate}>
                {post.scheduledAt
                  ? new Date(post.scheduledAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </Typography>
              <Typography lines={1} className={classes.upcomingText}>
                {post.text.replace(/\s+/g, " ").trim() || "Без текста"}
              </Typography>
            </Action>
          ))}
        </div>
      ) : (
        <Typography className={classes.emptySchedule}>
          Пока нет отложенных постов. Нажмите на день в календаре или выберите
          статус «Отложить».
        </Typography>
      )}

      <div className={["ui-stack ", classes.legend].filter(Boolean).join(" ")}>
        <div
          className={["ui-stack ", classes.legendItem]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
          <Typography className={classes.legendText}>Опубликован</Typography>
        </div>
        <div
          className={["ui-stack ", classes.legendItem]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
          />
          <Typography className={classes.legendText}>Запланирован</Typography>
        </div>
        <div
          className={["ui-stack ", classes.legendItem]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
          />
          <Typography className={classes.legendText}>Черновик</Typography>
        </div>
      </div>
    </div>
  );
}
function MonthGrid({
  year,
  month,
  postsByDay,
  stats,
  getStatusColor,
  onPostPress,
  onDayPress,
}: {
  year: number;
  month: number;
  postsByDay: Map<number, ScheduledPost[]>;
  stats: {
    published: number;
    scheduled: number;
    draft: number;
  };
  getStatusColor: (status: string) => string;
  onPostPress?: (post: ScheduledPost) => void;
  onDayPress?: (date: Date) => void;
}) {
  const firstDayOfMonth = new Date(year, month, 1);
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);
  return (
    <div
      className={["ui-stack ", classes.monthBlock].filter(Boolean).join(" ")}
    >
      <Typography className={classes.monthBlockTitle}>
        {MONTHS_RU[month]} {year}
      </Typography>
      <Typography className={classes.monthStats}>
        {stats.published} опубл. · {stats.scheduled} отложено · {stats.draft}{" "}
        черновик
      </Typography>
      <div
        className={["ui-stack ", classes.weekdayRow].filter(Boolean).join(" ")}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={["ui-stack ", classes.weekdayCell]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.weekdayText}>{day}</Typography>
          </div>
        ))}
      </div>
      <div
        className={["ui-stack ", classes.calendarGrid]
          .filter(Boolean)
          .join(" ")}
      >
        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${year}-${month}-${index}`}
                className={["ui-stack ", classes.dayCell]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          }
          const posts = postsByDay.get(day);
          const hasPost = Boolean(posts && posts.length > 0);
          const firstPost = hasPost ? posts![0] : null;
          const firstPhoto = firstPost?.photos?.[0];
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();
          return (
            <Action
              aria-label={`${new Date(year, month, day).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}${hasPost ? ": открыть публикацию" : ": создать публикацию"}`}
              key={`day-${year}-${month}-${day}`}
              onClick={() => {
                if (firstPost && onPostPress) {
                  onPostPress(firstPost);
                  return;
                }
                onDayPress?.(new Date(year, month, day, 10, 0, 0, 0));
              }}
              className={[
                classes.dayCell,
                isToday ? classes.backgroundColorState : "",
                isToday ? classes.borderRadiusState : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {firstPhoto ? (
                <div
                  className={["ui-stack ", classes.photoCircle]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Picture
                    source={{ uri: firstPhoto }}
                    contentFit="cover"
                    className={classes.photoCircleImage}
                  />
                  <div
                    className={["ui-stack ", classes.photoOverlay]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.dayNumberOnPhoto}>
                      {day}
                    </Typography>
                  </div>
                  <div
                    style={{
                      backgroundColor: getStatusColor(firstPost!.status),
                    }}
                    className={["ui-stack ", classes.div4]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </div>
              ) : hasPost ? (
                <div
                  style={{ borderColor: getStatusColor(firstPost!.status) }}
                  className={["ui-stack ", classes.div5]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.dayNumber}>{day}</Typography>
                  <div
                    style={{
                      backgroundColor: getStatusColor(firstPost!.status),
                    }}
                    className={["ui-stack ", classes.div4]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </div>
              ) : (
                <div
                  className={["ui-stack ", classes.emptyDay]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography
                    className={[
                      classes.todayNumber,
                      isToday
                        ? classes.appearanceState
                        : classes.appearanceState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {day}
                  </Typography>
                  {onDayPress ? (
                    <Typography className={classes.addHint}>+</Typography>
                  ) : null}
                </div>
              )}
              {posts && posts.length > 1 ? (
                <Typography className={classes.multiPostBadge}>
                  +{posts.length - 1}
                </Typography>
              ) : null}
            </Action>
          );
        })}
      </div>
    </div>
  );
}
