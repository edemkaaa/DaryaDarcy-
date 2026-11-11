// Архив Expo. Архивный календарь группирует полный admin.posts на клиенте и показывает два соседних месяца.
import { useState, useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

// ── Colors ──
const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const ACCENT = "#8B7355";
const OLIVE = "#6B7B5E";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

interface ScheduledPost {
  id: number;
  text: string;
  photos: string[] | null;
  status: string;
  target: string;
  scheduledAt: string | Date | null;
  publishedAt?: string | Date | null;
  createdAt: string | Date;
}

interface CalendarTrackerProps {
  onPostPress?: (post: ScheduledPost) => void;
  onDayPress?: (date: Date) => void;
}

export function CalendarTracker({ onPostPress, onDayPress }: CalendarTrackerProps) {
  // Архивный календарь группирует полный admin.posts на клиенте и показывает два соседних месяца.

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: allPosts, isLoading } = trpc.admin.posts.useQuery();

  const postsByDay = useMemo(() => {
    // Выбирает scheduledAt, затем publishedAt/createdAt и группирует записи в локальных календарных днях.

    const byMonth = new Map<string, Map<number, ScheduledPost[]>>();
    if (!allPosts) return byMonth;

    allPosts.forEach((post: any) => {
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
    // Сортирует отложенные публикации по времени и оставляет восемь ближайших из полного списка.

    if (!allPosts) return [] as ScheduledPost[];
    return (allPosts as ScheduledPost[])
      .filter((post) => post.status === "scheduled" && post.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime())
      .slice(0, 8);
  }, [allPosts]);

  const goToPrevMonth = () => {
    // Сдвигает опорный месяц назад с native haptic.

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    // Сдвигает опорный месяц вперёд с native haptic.

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getStatusColor = (status: string) => {
    // Назначает декоративный цвет опубликованному, отложенному и черновому статусу.

    switch (status) {
      case "published": return OLIVE;
      case "scheduled": return ACCENT;
      case "draft": return BROWN_LIGHT;
      default: return BROWN_LIGHT;
    }
  };

  const monthStats = (y: number, m: number) => {
    // Считает статусы внутри уже сгруппированного месяца без нового запроса.

    const map = postsByDay.get(`${y}-${m}`) || new Map();
    const posts = [...map.values()].flat();
    return {
      published: posts.filter((post) => post.status === "published").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      draft: posts.filter((post) => post.status === "draft").length,
    };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const monthsToShow = [0, 1].map((offset) => {
    const date = new Date(year, month + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable onPress={goToPrevMonth} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <MaterialIcons name="chevron-left" size={24} color={BROWN_DARK} />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS_RU[month]} — {MONTHS_RU[monthsToShow[1].month]} {monthsToShow[1].year}
        </Text>
        <Pressable onPress={goToNextMonth} style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <MaterialIcons name="chevron-right" size={24} color={BROWN_DARK} />
        </Pressable>
      </View>

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
        <View style={styles.upcoming}>
          <Text style={styles.upcomingTitle}>Отложенные публикации</Text>
          {upcoming.map((post) => (
            <Pressable
              key={post.id}
              onPress={() => onPostPress?.(post)}
              style={({ pressed }) => [styles.upcomingRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
              <Text style={styles.upcomingDate}>
                {post.scheduledAt
                  ? new Date(post.scheduledAt).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : ""}
              </Text>
              <Text style={styles.upcomingText} numberOfLines={1}>
                {post.text.replace(/\s+/g, " ").trim() || "Без текста"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySchedule}>
          Пока нет отложенных постов. Нажмите на день в календаре или выберите статус «Отложить».
        </Text>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: OLIVE }]} />
          <Text style={styles.legendText}>Опубликован</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
          <Text style={styles.legendText}>Запланирован</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BROWN_LIGHT }]} />
          <Text style={styles.legendText}>Черновик</Text>
        </View>
      </View>
    </View>
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
  stats: { published: number; scheduled: number; draft: number };
  getStatusColor: (status: string) => string;
  onPostPress?: (post: ScheduledPost) => void;
  onDayPress?: (date: Date) => void;
}) {
  // Строит сетку с понедельника, миниатюрой первого поста дня и переходом в пост либо создание на дату.

  const firstDayOfMonth = new Date(year, month, 1);
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  return (
    <View style={styles.monthBlock}>
      <Text style={styles.monthBlockTitle}>{MONTHS_RU[month]} {year}</Text>
      <Text style={styles.monthStats}>
        {stats.published} опубл. · {stats.scheduled} отложено · {stats.draft} черновик
      </Text>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${year}-${month}-${index}`} style={styles.dayCell} />;
          }

          const posts = postsByDay.get(day);
          const hasPost = Boolean(posts && posts.length > 0);
          const firstPost = hasPost ? posts![0] : null;
          const firstPhoto = firstPost?.photos?.[0];
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

          return (
            <Pressable
              key={`day-${year}-${month}-${day}`}
              style={[styles.dayCell, isToday && styles.todayCell]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (firstPost && onPostPress) {
                  onPostPress(firstPost);
                  return;
                }
                onDayPress?.(new Date(year, month, day, 10, 0, 0, 0));
              }}
            >
              {firstPhoto ? (
                <View style={styles.photoCircle}>
                  <Image source={{ uri: firstPhoto }} style={styles.photoCircleImage} contentFit="cover" />
                  <View style={styles.photoOverlay}>
                    <Text style={styles.dayNumberOnPhoto}>{day}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(firstPost!.status) }]} />
                </View>
              ) : hasPost ? (
                <View style={[styles.textCircle, { borderColor: getStatusColor(firstPost!.status) }]}>
                  <Text style={styles.dayNumber}>{day}</Text>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(firstPost!.status) }]} />
                </View>
              ) : (
                <View style={styles.emptyDay}>
                  <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day}</Text>
                  {onDayPress ? <Text style={styles.addHint}>+</Text> : null}
                </View>
              )}
              {posts && posts.length > 1 ? (
                <Text style={styles.multiPostBadge}>+{posts.length - 1}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ──
// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  container: { padding: 16 },
  loadingContainer: { padding: 40, alignItems: "center" },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond-Bold",
    color: BROWN_DARK,
    textAlign: "center",
    flex: 1,
  },
  monthBlock: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
  },
  monthBlockTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
    marginBottom: 4,
  },
  monthStats: {
    fontSize: 12,
    color: BROWN_LIGHT,
    marginBottom: 10,
  },
  addHint: { fontSize: 10, color: ACCENT, marginTop: -2 },
  upcoming: { marginTop: 4, marginBottom: 8 },
  upcomingTitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
    marginBottom: 8,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  upcomingDate: { fontSize: 12, color: ACCENT, width: 92 },
  upcomingText: { flex: 1, fontSize: 13, color: BROWN_DARK },
  emptySchedule: {
    fontSize: 13,
    color: BROWN_LIGHT,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  navBtn: { padding: 8 },
  weekdayRow: { flexDirection: "row", marginBottom: 8 },
  weekdayCell: { flex: 1, alignItems: "center" },
  weekdayText: { fontSize: 12, fontWeight: "600", color: BROWN_LIGHT },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  todayCell: {
    backgroundColor: "rgba(139,115,85,0.08)",
    borderRadius: 8,
  },
  emptyDay: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: { fontSize: 14, color: BROWN_DARK, fontWeight: "500" },
  todayNumber: { fontWeight: "800", color: ACCENT },
  photoCircle: {
    width: "90%",
    aspectRatio: 1,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
  },
  photoCircleImage: { width: "100%", height: "100%", borderRadius: 999 },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dayNumberOnPhoto: { fontSize: 14, fontWeight: "700", color: "#fff" },
  textCircle: {
    width: "80%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: CREAM_BG,
  },
  multiPostBadge: {
    position: "absolute",
    top: 0,
    right: 2,
    fontSize: 8,
    fontWeight: "700",
    color: ACCENT,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: BROWN_LIGHT },
});
