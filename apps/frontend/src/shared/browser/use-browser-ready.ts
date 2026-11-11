"use client";
/** Сервер и первый клиентский кадр используют одинаковое состояние; браузерные возможности включаются после гидратации. */
import { useSyncExternalStore } from "react";
/** Здесь нет внешнего изменяемого источника: React после подписки сам переключается с server snapshot на client snapshot. */
const subscribe = () => () => {};
/** Первый HTML и hydration-кадр получают false, затем клиентский snapshot разрешает браузерные элементы без рассогласования разметки. */
export function useBrowserReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
