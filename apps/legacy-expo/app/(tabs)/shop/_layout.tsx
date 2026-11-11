// Архив Expo. Даёт товарам Магазина собственный stack без общего native header.
import { Stack } from "expo-router";

export default function ShopTabLayout() {
  // Даёт товарам Магазина собственный stack без общего native header.

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
