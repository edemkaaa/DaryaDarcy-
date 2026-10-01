import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, Platform, StyleSheet, ImageBackground, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useClub } from "@/lib/club-context";

function HomeHeaderButton() {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.navigate("/(tabs)" as any)}
      style={({ pressed }) => ({
        marginLeft: 14,
        padding: 4,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <MaterialIcons name="home" size={22} color="#8B7355" />
    </Pressable>
  );
}

function ProfileHeaderButton() {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/profile")}
      style={({ pressed }) => ({
        marginRight: 14,
        padding: 4,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <MaterialIcons name="person-outline" size={22} color="#8B7355" />
    </Pressable>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isSubscribed: isClubSubscribed } = useClub();
  const bottomPadding = Platform.OS === "web" ? 14 : Math.max(insets.bottom, 16);
  const tabBarHeight = 62 + bottomPadding;
  const compactTabs = width < 360;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#5C4033",
        tabBarInactiveTintColor: "#8B7355",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <ImageBackground
            source={{ uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg" }}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { backgroundColor: "#FDF8F0" }]}
          />
        ),
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "transparent",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: compactTabs ? 8 : 10,
          fontFamily: "EBGaramond-Regular",
          letterSpacing: compactTabs ? 0 : 0.3,
          marginTop: 1,
          marginBottom: 4,
          includeFontPadding: false,
        },
        tabBarIconStyle: {
          marginBottom: -2,
          marginTop: 0,
        },
      }}
    >
      {/* Home screen — hidden from tab bar, accessible via top-left icon */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Лента",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="newspaper.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Видео",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="play.rectangle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          title: "Клуб",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="star.fill" color={color} />,
          ...(isClubSubscribed ? { tabBarStyle: { display: "none" } } : {}),
        }}
      />
      <Tabs.Screen
        name="interactive"
        options={{
          title: "Интерактив",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Библиотека",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Магазин",
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="bag.fill" color={color} />,
        }}
      />
      {/* Profile — hidden from tab bar, accessible via top-right icon */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
