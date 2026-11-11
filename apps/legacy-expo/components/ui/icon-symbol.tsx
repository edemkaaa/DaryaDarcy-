// Архив Expo. На Android/web переводит согласованные SF-имена в MaterialIcons через статическую таблицу.
// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "book.fill": "menu-book",
  "bag.fill": "shopping-bag",
  "star.fill": "star",
  "person.fill": "person",
  "newspaper.fill": "article",
  "sparkles": "auto-awesome",
  "play.rectangle.fill": "play-circle-outline",
  "leaf.fill": "eco",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // На Android/web переводит согласованные SF-имена в MaterialIcons через статическую таблицу.

  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
