// Архив Expo. Проверяет browser Notification API и уже выданное разрешение.
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";

const FEED_SEEN_KEY = "@darcy_last_seen_feed_id";
const CLUB_SEEN_KEY = "@darcy_last_seen_club_id";

function canNotify(): boolean {
  // Проверяет browser Notification API и уже выданное разрешение.

  return (
    Platform.OS === "web" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

function showNote(title: string, body: string) {
  // Показывает короткое web-уведомление, считая ошибку необязательной для основного интерфейса.

  if (!canNotify()) return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // ignored
  }
}

export function WebPostAlerts() {
  // Опрашивает последние id каждые 90 секунд и хранит увиденные id в общем локальном кеше устройства.

  const primed = useRef(false);
  const latest = trpc.notifications.latest.useQuery(undefined, {
    enabled: Platform.OS === "web",
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // После обновления latest сравнивает id с локальным seen; исторический async не отменяется при смене аккаунта.

    if (Platform.OS !== "web") return;
    const feedId = latest.data?.feedId;
    const clubId = latest.data?.clubId;

    const run = async () => {
      // Первый ответ только инициализирует seen, следующие сравнивает с сохранёнными id перед уведомлением.

      if (!primed.current) {
        if (feedId) {
          const seen = await AsyncStorage.getItem(FEED_SEEN_KEY);
          if (!seen) await AsyncStorage.setItem(FEED_SEEN_KEY, String(feedId));
        }
        if (clubId) {
          const seen = await AsyncStorage.getItem(CLUB_SEEN_KEY);
          if (!seen) await AsyncStorage.setItem(CLUB_SEEN_KEY, String(clubId));
        }
        primed.current = true;
        return;
      }

      if (feedId) {
        const seenRaw = await AsyncStorage.getItem(FEED_SEEN_KEY);
        if (!seenRaw) {
          await AsyncStorage.setItem(FEED_SEEN_KEY, String(feedId));
        } else if (feedId > Number(seenRaw)) {
          showNote("Новый пост в ленте", String(latest.data?.feedText || "").slice(0, 80));
          await AsyncStorage.setItem(FEED_SEEN_KEY, String(feedId));
        }
      }
      if (clubId) {
        const seenRaw = await AsyncStorage.getItem(CLUB_SEEN_KEY);
        if (!seenRaw) {
          await AsyncStorage.setItem(CLUB_SEEN_KEY, String(clubId));
        } else if (clubId > Number(seenRaw)) {
          showNote("Новый пост в клубе", String(latest.data?.clubText || "").slice(0, 80));
          await AsyncStorage.setItem(CLUB_SEEN_KEY, String(clubId));
        }
      }
    };

    void run();
  }, [latest.data]);

  useEffect(() => {
    // Через пять секунд предлагает разрешение web-уведомлений и снимает таймер при unmount.

    if (Platform.OS !== "web" || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const timer = setTimeout(() => {
      void Notification.requestPermission();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
