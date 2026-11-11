// Архив Expo. Собирает дочерние материалы Библиотеки в stack без дублирующего header.
import { Stack } from "expo-router";

export default function LibraryLayout() {
  // Собирает дочерние материалы Библиотеки в stack без дублирующего header.

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="aesthetics-guide" />
      <Stack.Screen name="patterns" />
      <Stack.Screen name="about-me" />
      <Stack.Screen name="article/[id]" />
    </Stack>
  );
}
