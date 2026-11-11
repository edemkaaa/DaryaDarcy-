// Архив Expo. Показывает native уведомление на переднем плане со звуком, не меняя badge.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification handler for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => /* Показывает native уведомление на переднем плане со звуком, не меняя badge. */ ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions (must be called before scheduling).
 * Returns true if permissions are granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  // Создаёт Android-канал и спрашивает разрешение native ОС; на web возвращает отказ.

  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("scheduled-posts", {
      name: "Отложенные публикации",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Schedule a local notification reminder for a scheduled post.
 * The notification fires at the scheduled time to remind the admin to publish.
 *
 * @param postId - The post ID (used as notification identifier for cancellation)
 * @param scheduledAt - The Date when the post is scheduled
 * @param postPreview - A short preview of the post text (first 60 chars)
 */
export async function schedulePostReminder(
  postId: number | string,
  scheduledAt: Date,
  postPreview: string
): Promise<string | null> {
  // Планирует локальное напоминание только на будущую дату; оно не публикует пост на сервере.

  if (Platform.OS === "web") return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  // Don't schedule if the date is in the past
  const now = new Date();
  if (scheduledAt.getTime() <= now.getTime()) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Время публиковать пост 📝",
      body: postPreview.slice(0, 100) || "У вас запланирована публикация",
      data: { postId: String(postId), type: "scheduled_post_reminder" },
      ...(Platform.OS === "android" ? { channelId: "scheduled-posts" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledAt,
    },
  });

  return identifier;
}

/**
 * Cancel a previously scheduled notification by its identifier.
 */
export async function cancelPostReminder(identifier: string): Promise<void> {
  // Отменяет одно native напоминание по идентификатору Expo.

  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancel all scheduled notifications (useful for cleanup).
 */
export async function cancelAllPostReminders(): Promise<void> {
  // Исторически отменяет все уведомления приложения без фильтра по типу напоминания.

  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all currently scheduled notifications.
 */
export async function getScheduledReminders() {
  // Читает все локальные native расписания, а не серверный календарь публикаций.

  if (Platform.OS === "web") return [];
  return Notifications.getAllScheduledNotificationsAsync();
}
