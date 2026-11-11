// Архив Expo. Выключенный маршрут совместимости переносит boardId на основной экран доски.
import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

/** Legacy route → главный экран мудборда. */
export default function MoodboardSeasonRedirect() {
  // Выключенный маршрут совместимости переносит boardId на основной экран доски.

  const router = useRouter();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string }>();
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;

  useEffect(() => {
    // После получения параметров заменяет старый маршрут, не добавляя лишний шаг в историю.

    router.replace((boardId ? `/moodboard?boardId=${boardId}` : "/moodboard") as any);
  }, [boardId, router]);

  return null;
}
