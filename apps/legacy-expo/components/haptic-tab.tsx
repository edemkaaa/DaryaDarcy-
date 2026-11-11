// Архив Expo. Добавляет iOS haptic и web fallback нажатия, сохраняя обработчики навигационной кнопки.
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { pressableProps } from "@/lib/ios-web-press";

export function HapticTab(props: BottomTabBarButtonProps) {
  // Добавляет iOS haptic и web fallback нажатия, сохраняя обработчики навигационной кнопки.

  const { onPress, ...rest } = props;
  const pressFix =
    Platform.OS === "web" && onPress ? pressableProps(onPress) : { onPress };

  return (
    <PlatformPressable
      {...rest}
      {...pressFix}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
