"use client";
/** Перед подготовкой нового письма нужен актуальный получатель; ошибочное обновление не подменяем старым контактом. */
import { useQuery } from "@tanstack/react-query";
import { contentRefreshOptions } from "@/shared/api/content-refresh";
import { useEffect } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { publicConfigurationOptions } from "./public-configuration";
import { parseManagerOrderSettings } from "./settings";

/** Для нового заказа используем только успешное актуальное чтение получателя; старые данные при ошибке намеренно не возвращаем. */
export function useManagerOrderSettings(enabled = true) {
  const active = useScreenActive();
  const query = useQuery({
    ...publicConfigurationOptions(),
    select: parseManagerOrderSettings,
    ...contentRefreshOptions(enabled && active),
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  const { refetch } = query;
  useEffect(() => {
    if (!enabled || !active) return;
    /** На focus/pageshow видимого активного экрана перечитываем настройки без отмены текущего запроса. */
    const refresh = () => {
      if (document.visibilityState === "visible")
        void refetch({ cancelRefetch: false });
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [enabled, active, refetch]);
  return {
    // A failed refresh must not offer an old recipient for a new order.
    settings: query.isSuccess ? query.data : undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPaused: query.isPaused,
    error: query.error,
    retry: () => query.refetch({ cancelRefetch: false }),
  };
}
