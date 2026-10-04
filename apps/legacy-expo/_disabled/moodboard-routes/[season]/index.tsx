import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

/** Legacy route → главный экран мудборда. */
export default function MoodboardSeasonRedirect() {
  const router = useRouter();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string }>();
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;

  useEffect(() => {
    router.replace((boardId ? `/moodboard?boardId=${boardId}` : "/moodboard") as any);
  }, [boardId, router]);

  return null;
}
