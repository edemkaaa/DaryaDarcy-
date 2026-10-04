import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Passthrough wrapper — tab visibility is handled via CSS on aria-hidden layers. */
export function TabFocusGate({ children, style }: Props) {
  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}
