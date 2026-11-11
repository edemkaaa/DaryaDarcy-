// Архив Expo. Глобальное сопоставление NativeWind для Pressable: стили передаются явно через style вместо className.
// NativeWind + Pressable: className can swallow onPress. Disable className mapping globally.
import { Pressable } from "react-native";
import { remapProps } from "nativewind";

remapProps(Pressable, { className: false });
