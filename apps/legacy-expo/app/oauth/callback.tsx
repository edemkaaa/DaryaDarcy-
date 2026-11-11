// Архив Expo. Оставляет совместимый вход по старым OAuth-ссылкам, перенаправляя на email login.
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Manus OAuth is retired. Old callback links go to email login. */
export default function OAuthCallback() {
  // Оставляет совместимый вход по старым OAuth-ссылкам, перенаправляя на email login.

  const router = useRouter();
  useEffect(() => {
    // Заменяет устаревший callback маршрутом входа без сохранения его в истории.

    router.replace("/login");
  }, [router]);
  return null;
}
