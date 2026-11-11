// Архив Expo. До клиентской гидратации возвращает light, затем использует системную схему браузера.
import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  // До клиентской гидратации возвращает light, затем использует системную схему браузера.

  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // После монтирования разрешает системную схему, не меняя первый статический render.

    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return "light";
}
