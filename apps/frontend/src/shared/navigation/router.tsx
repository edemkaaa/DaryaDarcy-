"use client";
/** Обёртка навигации объединяет переходы, вход и безопасный возврат; экраны не должны самостоятельно переписывать историю Next. */
import { useRouter as useNextRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import NextLink from "next/link";
import { hasAppHistory } from "./history";
import { parentRoute } from "./parent-route";
import { notifyNavigationStart } from "./navigation-start";
import { useScreenActive } from "./screen-activity";
import {
  consumeLoginReturn,
  rememberClubNavigation,
  rememberLoginReturn,
  type LoginDestination,
} from "./navigation-intent";
type Destination =
  | string
  | {
      pathname: string;
      params?: Record<string, string | number | undefined>;
    };
/** Убираем старую Expo-группу из пути и распределяем параметры между динамическим сегментом и query, кодируя значения. */
export function publicPath(to: Destination): string {
  const path = typeof to === "string" ? to : to.pathname;
  let result = path.replace(/\/\(tabs\)/g, "").replace(/\/index$/, "") || "/";
  if (typeof to !== "string" && to.params) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(to.params)) {
      if (v === undefined) continue;
      const token = `[${k}]`;
      if (result.includes(token))
        result = result.replace(token, encodeURIComponent(String(v)));
      else query.set(k, String(v));
    }
    if (query.size) result += "?" + query;
  }
  return result;
}
/** Возвращаем единые команды Next с уведомлением об уходе и сохранением согласованных login/club намерений. */
export function useRouter() {
  const next = useNextRouter();
  const path = usePathname();
  return useMemo(
    () => ({
      push: (to: Destination) => {
        notifyNavigationStart(publicPath(to));
        next.push(publicPath(to));
      },
      replace: (to: Destination) => {
        notifyNavigationStart(publicPath(to));
        next.replace(publicPath(to));
      },
      login: (returnTo: string | LoginDestination = path, replace = false) => {
        rememberLoginReturn(returnTo);
        notifyNavigationStart("/login");
        if (replace) next.replace("/login");
        else next.push("/login");
      },
      /** После входа намерение потребляется один раз; клубные флаги переносятся отдельно от строки публичного URL. */
      finishLogin: () => {
        const destination = consumeLoginReturn();
        if (destination.club) rememberClubNavigation(destination.club);
        notifyNavigationStart(destination.pathname);
        next.replace(destination.pathname);
      },
      clubCheckout: () => {
        rememberClubNavigation({ checkout: true, paymentReturn: false });
        next.push("/club");
      },
      /** Используем back только для своей истории приложения; прямой вход получает родительский раздел вместо внешней страницы. */
      back: () => {
        notifyNavigationStart();
        if (hasAppHistory()) next.back();
        else next.replace(parentRoute(path));
      },
      canGoBack: hasAppHistory,
    }),
    [next, path],
  );
}
export type Router = ReturnType<typeof useRouter>;
/** Запускаем эффект только для активного сохранённого экрана; изменение маршрута вызывает его штатную очистку. */
export function useFocusEffect(effect: () => void | (() => void)) {
  const path = usePathname();
  const active = useScreenActive();
  useEffect(() => (active ? effect() : undefined), [effect, path, active]);
}
/** Для совместимых экранов фокус означает активность панели, а не только наличие её DOM в документе. */
export function useIsFocused() {
  return useScreenActive();
}
/** Совместимую ссылку переводим в публичный путь; prefetch отключён, чтобы не запускать ненужные загрузки соседних экранов. */
export const Link = ({
  href,
  children,
  ...props
}: {
  href: Destination;
  children: ReactNode;
  [k: string]: unknown;
}) => (
  <NextLink href={publicPath(href)} prefetch={false} {...props}>
    {children}
  </NextLink>
);
/** Клиентский redirect выполняет replace через общий router, сохраняя уведомление уходящей странице. */
export const Redirect = ({ href }: { href: Destination }) => {
  const r = useRouter();
  useEffect(() => r.replace(href), [r, href]);
  return null;
};
