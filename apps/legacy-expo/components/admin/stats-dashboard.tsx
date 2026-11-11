// Архив Expo. Показывает серверные агрегаты и вычисляет только сравнительную динамику месяца в UI.
import { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const ACCENT = "#8B7355";

export function StatsDashboard() {
  // Показывает серверные агрегаты и вычисляет только сравнительную динамику месяца в UI.

  const { data: stats, isLoading, refetch } = trpc.admin.stats.useQuery(undefined, {
    retry: 1,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    // Запрашивает свежие агрегаты и снимает pull-to-refresh после результата.

    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Загрузка статистики...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialIcons name="error-outline" size={32} color={BROWN_LIGHT} />
        <Text style={styles.loadingText}>Не удалось загрузить статистику</Text>
      </View>
    );
  }

  const monthDiff = stats.postsLastMonth > 0
    ? Math.round(((stats.postsThisMonth - stats.postsLastMonth) / stats.postsLastMonth) * 100)
    : stats.postsThisMonth > 0 ? 100 : 0;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      {/* Overview Cards */}
      <Text style={styles.sectionTitle}>Обзор</Text>
      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <MaterialIcons name="article" size={24} color={ACCENT} />
          <Text style={styles.cardNumber}>{stats.totalPosts}</Text>
          <Text style={styles.cardLabel}>Всего постов</Text>
        </View>
        <View style={styles.card}>
          <MaterialIcons name="favorite" size={24} color="#E57373" />
          <Text style={styles.cardNumber}>{stats.totalLikes}</Text>
          <Text style={styles.cardLabel}>Лайков</Text>
        </View>
        <View style={styles.card}>
          <MaterialIcons name="bookmark" size={24} color="#FFB74D" />
          <Text style={styles.cardNumber}>{stats.totalSaves}</Text>
          <Text style={styles.cardLabel}>Сохранений</Text>
        </View>
      </View>

      {/* Status Breakdown */}
      <Text style={styles.sectionTitle}>По статусу</Text>
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <View style={[styles.statusDot, { backgroundColor: "#4CAF50" }]} />
          <Text style={styles.breakdownLabel}>Опубликовано</Text>
          <Text style={styles.breakdownValue}>{stats.publishedPosts}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={[styles.statusDot, { backgroundColor: "#FF9800" }]} />
          <Text style={styles.breakdownLabel}>Запланировано</Text>
          <Text style={styles.breakdownValue}>{stats.scheduledPosts}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={[styles.statusDot, { backgroundColor: "#9E9E9E" }]} />
          <Text style={styles.breakdownLabel}>Черновики</Text>
          <Text style={styles.breakdownValue}>{stats.draftPosts}</Text>
        </View>
      </View>

      {/* Target Breakdown */}
      <Text style={styles.sectionTitle}>По каналу</Text>
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <MaterialIcons name="dynamic-feed" size={16} color={ACCENT} />
          <Text style={styles.breakdownLabel}>Лента</Text>
          <Text style={styles.breakdownValue}>{stats.feedPosts}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <MaterialIcons name="groups" size={16} color={ACCENT} />
          <Text style={styles.breakdownLabel}>Клуб</Text>
          <Text style={styles.breakdownValue}>{stats.clubPosts}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <MaterialIcons name="merge-type" size={16} color={ACCENT} />
          <Text style={styles.breakdownLabel}>Оба</Text>
          <Text style={styles.breakdownValue}>{stats.bothPosts}</Text>
        </View>
      </View>

      {/* Monthly Activity */}
      <Text style={styles.sectionTitle}>Активность</Text>
      <View style={styles.breakdownCard}>
        <View style={styles.breakdownRow}>
          <MaterialIcons name="today" size={16} color={ACCENT} />
          <Text style={styles.breakdownLabel}>Этот месяц</Text>
          <Text style={styles.breakdownValue}>{stats.postsThisMonth}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <MaterialIcons name="event" size={16} color={BROWN_LIGHT} />
          <Text style={styles.breakdownLabel}>Прошлый месяц</Text>
          <Text style={styles.breakdownValue}>{stats.postsLastMonth}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <MaterialIcons
            name={monthDiff >= 0 ? "trending-up" : "trending-down"}
            size={16}
            color={monthDiff >= 0 ? "#4CAF50" : "#E57373"}
          />
          <Text style={styles.breakdownLabel}>Динамика</Text>
          <Text style={[styles.breakdownValue, { color: monthDiff >= 0 ? "#4CAF50" : "#E57373" }]}>
            {monthDiff >= 0 ? "+" : ""}{monthDiff}%
          </Text>
        </View>
      </View>

      {/* Top Liked Posts */}
      {stats.topLikedPosts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Топ по лайкам</Text>
          <View style={styles.breakdownCard}>
            {stats.topLikedPosts.map((post, i) => (
              <View key={post.id} style={[styles.breakdownRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#E8E2D8", paddingTop: 8 }]}>
                <Text style={styles.rankNumber}>#{i + 1}</Text>
                <Text style={styles.topPostText} numberOfLines={1}>{post.text || "Без текста"}</Text>
                <View style={styles.likesBadge}>
                  <MaterialIcons name="favorite" size={12} color="#E57373" />
                  <Text style={styles.likesCount}>{post.likeCount}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  loadingText: { fontSize: 14, color: BROWN_LIGHT },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: BROWN_DARK,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "EBGaramond-SemiBold",
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: CREAM_BG,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Bold",
  },
  cardLabel: {
    fontSize: 11,
    color: BROWN_LIGHT,
    textAlign: "center",
  },
  breakdownCard: {
    backgroundColor: CREAM_BG,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: BROWN_DARK,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: "600",
    color: BROWN_DARK,
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT,
    width: 24,
  },
  topPostText: {
    flex: 1,
    fontSize: 13,
    color: BROWN_DARK,
  },
  likesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFF0F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  likesCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E57373",
  },
});
