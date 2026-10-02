import { Stack } from "expo-router";

export default function LibraryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="aesthetics-guide" />
      <Stack.Screen name="patterns" />
      <Stack.Screen name="about-me" />
      <Stack.Screen name="article/[id]" />
    </Stack>
  );
}
