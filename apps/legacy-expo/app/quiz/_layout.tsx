// Архив Expo. Ограничивает тест одним stack-экраном с fade-переходом.
import { Stack } from "expo-router";

export default function QuizLayout() {
  // Ограничивает тест одним stack-экраном с fade-переходом.

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
