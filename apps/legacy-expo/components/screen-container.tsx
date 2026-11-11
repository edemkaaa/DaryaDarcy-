// Архив Expo. Отделяет фоновый полноэкранный слой от SafeArea; нижний inset обычно задаёт tab bar.
import { View, ImageBackground, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

const paperTextureUri = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
  /**
   * Whether to show the paper texture background. Defaults to true.
   */
  showTexture?: boolean;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 * Includes a subtle paper texture background for a rustic, warm feel.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  showTexture = true,
  style,
  ...props
}: ScreenContainerProps) {
  // Отделяет фоновый полноэкранный слой от SafeArea; нижний inset обычно задаёт tab bar.

  const content = (
    <SafeAreaView
      edges={edges}
      className={cn("flex-1", safeAreaClassName)}
      style={style}
    >
      <View className={cn("flex-1", className)}>{children}</View>
    </SafeAreaView>
  );

  if (showTexture) {
    return (
      <ImageBackground
        source={{ uri: paperTextureUri }}
        resizeMode="cover"
        className={cn("flex-1", containerClassName)}
        style={{ backgroundColor: "#F5EDE3" }}
        {...props}
      >
        {content}
      </ImageBackground>
    );
  }

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      {...props}
    >
      {content}
    </View>
  );
}
