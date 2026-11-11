// Архив Expo. Добавляет фон текущей NativeWind темы и объединяет внешние классы без изменения View props.
import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/utils";

export interface ThemedViewProps extends ViewProps {
  className?: string;
}

/**
 * A View component with automatic theme-aware background.
 * Uses NativeWind for styling - pass className for additional styles.
 */
export function ThemedView({ className, ...otherProps }: ThemedViewProps) {
  // Добавляет фон текущей NativeWind темы и объединяет внешние классы без изменения View props.

  return <View className={cn("bg-background", className)} {...otherProps} />;
}
