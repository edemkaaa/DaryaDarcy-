"use client";
import { useRouter as useNextRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import NextLink from "next/link";
import { hasAppHistory } from "./history";
import { parentRoute } from "./parent-route";
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
export function useRouter() {
  const next = useNextRouter();
  const path = usePathname();
  return useMemo(
    () => ({
      push: (to: Destination) => next.push(publicPath(to)),
      replace: (to: Destination) => next.replace(publicPath(to)),
      login: (returnTo: string | LoginDestination = path, replace = false) => {
        rememberLoginReturn(returnTo);
        if (replace) next.replace("/login");
        else next.push("/login");
      },
      finishLogin: () => {
        const destination = consumeLoginReturn();
        if (destination.club) rememberClubNavigation(destination.club);
        next.replace(destination.pathname);
      },
      clubCheckout: () => {
        rememberClubNavigation({ checkout: true, paymentReturn: false });
        next.push("/club");
      },
      back: () =>
        hasAppHistory() ? next.back() : next.replace(parentRoute(path)),
      canGoBack: hasAppHistory,
    }),
    [next, path],
  );
}
export type Router = ReturnType<typeof useRouter>;
export function useFocusEffect(effect: () => void | (() => void)) {
  const path = usePathname();
  const active = useScreenActive();
  useEffect(() => (active ? effect() : undefined), [effect, path, active]);
}
export function useIsFocused() {
  return useScreenActive();
}
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
export const Redirect = ({ href }: { href: Destination }) => {
  const r = useRouter();
  useEffect(() => r.replace(href), [r, href]);
  return null;
};
