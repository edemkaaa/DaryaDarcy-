import { WEB_APP_MAX_WIDTH } from "@/lib/web-viewport";
import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { ClubProvider } from "@/lib/club-context";
import { AuthProvider } from "@/hooks/use-auth";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { registerNativePush } from "@/lib/register-push";
import { SplashScreen } from "@/lib/splash-boot";
import { InstallGuide } from "@/components/install-guide";
import { WebPostAlerts } from "@/components/web-post-alerts";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 12, left: 0 };

function getWebFrame(): Rect {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: WEB_APP_MAX_WIDTH, height: 800 };
  }
  return {
    x: 0,
    y: 0,
    width: Math.min(window.innerWidth, WEB_APP_MAX_WIDTH),
    height: window.innerHeight,
  };
}

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "PlayfairDisplay-Regular": require("@/assets/fonts/PlayfairDisplay-Regular.ttf"),
    "PlayfairDisplay-Italic": require("@/assets/fonts/PlayfairDisplay-Italic.ttf"),
    "EBGaramond-Regular": require("@/assets/fonts/EBGaramond-Regular.ttf"),
    "EBGaramond-Italic": require("@/assets/fonts/EBGaramond-Italic.ttf"),
    "EBGaramond-SemiBold": require("@/assets/fonts/EBGaramond-SemiBold.ttf"),
    "EBGaramond-Bold": require("@/assets/fonts/EBGaramond-Bold.ttf"),
    "Gogol-Regular": require("@/assets/fonts/Gogol-Regular.ttf"),
    "Woolen-Regular": require("@/assets/fonts/Woolen-Regular.ttf"),
  });

  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = Platform.OS === "web" ? getWebFrame() : (initialWindowMetrics?.frame ?? getWebFrame());

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  const router = useRouter();

  useEffect(() => {
    initManusRuntime();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    return registerNativePush(router);
  }, [router]);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame({
      ...metrics.frame,
      width: Math.min(metrics.frame.width || WEB_APP_MAX_WIDTH, WEB_APP_MAX_WIDTH),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onResize = () => setFrame(getWebFrame());
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    onResize();
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      unsubscribe();
    };
  }, [handleSafeAreaUpdate]);

  useEffect(() => {
    if (Platform.OS === "web" || fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: metrics.insets.top,
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (Platform.OS !== "web" && !fontsLoaded && !fontError) {
    return null;
  }

  const content = (
    <GestureHandlerRootView
      style={{
        flex: 1,
        width: "100%",
        backgroundColor: Platform.OS === "web" ? "#FDF8F0" : undefined,
        ...(Platform.OS === "web"
          ? { maxWidth: WEB_APP_MAX_WIDTH, alignSelf: "center" as const }
          : null),
      }}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
          <ClubProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#FDF8F0", flex: 1 },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="library" />
            <Stack.Screen name="post/[id]" />
            <Stack.Screen name="admin/index" options={{ presentation: "modal" }} />
            <Stack.Screen name="login" options={{ presentation: "modal" }} />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="legal/index" />
            <Stack.Screen name="legal/[slug]" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <InstallGuide />
          <WebPostAlerts />
          <StatusBar style="auto" />
          </ClubProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
