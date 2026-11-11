// Архив Expo. Удержание native splash до готовности корневого layout; web использует отдельную платформенную реализацию.
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export { SplashScreen };
