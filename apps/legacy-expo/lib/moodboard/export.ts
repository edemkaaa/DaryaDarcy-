// Архив Expo. Исторический native fallback сохраняет первое фото, а не коллаж; запрашивает галерею и использует один временный путь.
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import type { MoodboardDoc } from "@/lib/moodboard/types";

export async function saveAndShareMoodboard(_board: MoodboardDoc): Promise<void> {
  // Исторический native fallback сохраняет первое фото, а не коллаж; запрашивает галерею и использует один временный путь.

  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Нужен доступ к галерее");
  }
  // Native composite export: share first item as fallback until view capture is added.
  const first = _board.items[0];
  if (!first?.uri) throw new Error("Добавьте хотя бы одно фото");
  const cacheDir = FileSystem.documentDirectory ?? FileSystem.bundleDirectory ?? "";
  const dest = `${cacheDir}moodboard-share.png`;
  await FileSystem.downloadAsync(first.uri, dest);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, { mimeType: "image/png", dialogTitle: "Сохранить мудборд" });
  }
  await MediaLibrary.saveToLibraryAsync(dest);
}
