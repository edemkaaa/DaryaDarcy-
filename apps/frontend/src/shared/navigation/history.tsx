"use client";
/** Маркеры истории добавляем рядом со служебными данными Next, сохраняя сведения о переходах самого приложения. */
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  clearOtherPageIntents,
  navigationIntentEvent,
} from "./navigation-intent";

const entryIndex = "__darcyEntryIndex";

/** Наличие предыдущей записи определяем своим индексом: history.length включает внешние сайты и пустую стартовую вкладку. */
export function hasAppHistory() {
  return (
    typeof window !== "undefined" && window.history.state?.[entryIndex] > 0
  );
}

/** Добавляем индекс к push/replace, сохраняя служебные поля Next; при cleanup возвращаем только всё ещё свои wrappers. history.length включает внешние страницы и начальную пустую вкладку, поэтому для возврата его недостаточно. */
export function NavigationHistory() {
  const path = usePathname();
  const params = useSearchParams().toString();
  useEffect(clearOtherPageIntents, [path, params]);
  useEffect(() => {
    const history = window.history;
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    /** У прямого входа индекс начинается с нуля; только собственный push увеличивает глубину безопасного back. */
    const index = () => history.state?.[entryIndex] ?? 0;
    replaceState.call(history, { ...history.state, [entryIndex]: index() }, "");
    /** Новая запись получает следующий индекс, затем очищает чужие hints и уведомляет читающие навигацию компоненты. */
    const push: History["pushState"] = function (state, title, url) {
      pushState.call(
        history,
        { ...state, [entryIndex]: index() + 1 },
        title,
        url,
      );
      clearOtherPageIntents();
      window.dispatchEvent(new Event(navigationIntentEvent));
    };
    /** Замена текущей записи сохраняет индекс, иначе обычная очистка query выглядела бы как дополнительный шаг назад. */
    const replace: History["replaceState"] = function (state, title, url) {
      replaceState.call(
        history,
        { ...state, [entryIndex]: index() },
        title,
        url,
      );
    };
    history.pushState = push;
    history.replaceState = replace;
    return () => {
      if (history.pushState === push) history.pushState = pushState;
      if (history.replaceState === replace) history.replaceState = replaceState;
    };
  }, []);
  return null;
}
