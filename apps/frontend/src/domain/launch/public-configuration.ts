/** Общий запрос хранит полный публичный ответ настроек; каждый потребитель проверяет только нужную ему часть. */
import { queryOptions } from "@tanstack/react-query";
import { apiCall } from "@/shared/api/auth";

export const PUBLIC_LAUNCH_KEY = ["launch-config"];

/** Один публичный query хранит полный неизвестный ответ; каждый select валидирует свою часть без вытеснения остальных настроек. */
export function publicConfigurationOptions() {
  return queryOptions({
    queryKey: PUBLIC_LAUNCH_KEY,
    queryFn: ({ signal }) => apiCall<unknown>("/api/launch-config", { signal }),
    staleTime: 0,
    retry: false,
  });
}
