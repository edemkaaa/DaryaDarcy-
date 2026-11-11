"use client";
/** Уведомления о новых постах зависят от доступности функции и разрешения браузера; локальный опрос не является очередью гарантированной доставки. */
import { useEffect, useRef } from "react";
import AsyncStorage from "@/shared/browser/storage";
import { trpc } from "@/shared/api/trpc";
import { useCapabilities } from "@/shared/api/capabilities";
const FEED_SEEN_KEY = "@darcy_last_seen_feed_id";
const CLUB_SEEN_KEY = "@darcy_last_seen_club_id";
/** Проверяем существование браузерного Notification API и уже выданное разрешение. */
function canNotify(): boolean {
  return (
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
}
/** Пробуем локальное уведомление без обещания гарантированной доставки; отказ платформы не ломает чтение постов. */
function showNote(title: string, body: string) {
  if (!canNotify()) return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {}
}
/** При включённой возможности опрашиваем latest и сравниваем локальные seen-маркеры; первый запуск только инициализирует базу. */
export function WebPostAlerts() {
  const { webPush } = useCapabilities();
  const primed = useRef(false);
  const latest = trpc.notifications.latest.useQuery(undefined, {
    enabled: webPush,
    refetchInterval: 90000,
  });
  useEffect(() => {
    if (!webPush) return;
    const feedId = latest.data?.feedId;
    const clubId = latest.data?.clubId;
    /** Запоминаем впервые увиденный ID без уведомления; дальнейший рост ID создаёт локальную подсказку и обновляет seen. */
    const run = async () => {
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
          showNote(
            "Новый пост в ленте",
            String(latest.data?.feedText || "").slice(0, 80),
          );
          await AsyncStorage.setItem(FEED_SEEN_KEY, String(feedId));
        }
      }
      if (clubId) {
        const seenRaw = await AsyncStorage.getItem(CLUB_SEEN_KEY);
        if (!seenRaw) {
          await AsyncStorage.setItem(CLUB_SEEN_KEY, String(clubId));
        } else if (clubId > Number(seenRaw)) {
          showNote(
            "Новый пост в клубе",
            String(latest.data?.clubText || "").slice(0, 80),
          );
          await AsyncStorage.setItem(CLUB_SEEN_KEY, String(clubId));
        }
      }
    };
    void run();
  }, [latest.data, webPush]);
  useEffect(() => {
    if (!webPush) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const timer = setTimeout(() => {
      void Notification.requestPermission();
    }, 5000);
    return () => clearTimeout(timer);
  }, [webPush]);
  return null;
}
