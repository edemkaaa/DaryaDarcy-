// Архив Expo. Архивный выключенный layout объединяет маршруты доски без общего header.
import { Stack } from "expo-router";

export default function MoodboardLayout() {
  // Архивный выключенный layout объединяет маршруты доски без общего header.

  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
