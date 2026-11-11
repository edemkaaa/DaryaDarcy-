// Архив Expo. Запрашивает разрешение только на настоящем native устройстве и отправляет Expo-токен; сбой push необязателен для входа.
import type { Router } from "expo-router";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";

export async function registerPushToken(): Promise<void> {
  // Запрашивает разрешение только на настоящем native устройстве и отправляет Expo-токен; сбой push необязателен для входа.

  if (Platform.OS === "web" || !Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    const sessionToken = await getSessionToken();

    await fetch(`${getApiBaseUrl()}/api/trpc/notifications.registerToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ json: { token, platform: Platform.OS } }),
    });
  } catch {
    // native push is optional
  }
}

export function registerNativePush(router: Pick<Router, "push">): () => void {
  // Подключает native foreground/display и переход по типизированному postId, возвращая снятие listener.

  Notifications.setNotificationHandler({
    handleNotification: async () => /* Разрешает banner/list/sound, сохраняя badge без изменений. */ ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  void registerPushToken();

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.postId && (data?.type === "new_post" || data?.type === "comment_reply")) {
      router.push(`/post/${data.postId}`);
    }
  });

  return () => responseSubscription.remove();
}
