"use client";
import dynamic from "next/dynamic";
import {
  Component,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ScreenActivity } from "@/shared/navigation/screen-activity";
import TabLoading from "./tab-loading";
import styles from "./tab-shell.module.scss";
import RouteError from "./error";

class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <RouteError reset={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}

// Load only visited sections. Keeping their own DOM preserves scroll, filters,
// decoded images and first-entry motion, including after opening a detail page.
const screens = {
  "/": dynamic(() => import("@/features/home/home-screen")),
  "/feed": dynamic(() => import("@/features/feed/feed-screen")),
  "/videos": dynamic(() => import("@/features/videos/videos-screen")),
  "/club": dynamic(() => import("@/features/club/club-screen")),
  "/interactive": dynamic(() => import("@/features/quiz/interactive-screen")),
  "/quiz": dynamic(() => import("@/features/quiz/quiz-screen")),
  "/quiz/result": dynamic(() =>
    import("@/features/quiz/quiz-screen").then(
      (module) => module.SavedQuizScreen,
    ),
  ),
  "/library": dynamic(() => import("@/features/library/library-screen")),
  "/library/patterns": dynamic(
    () => import("@/features/library/patterns-screen"),
  ),
  "/library/aesthetics-guide": dynamic(
    () => import("@/features/library/aesthetics-screen"),
  ),
  "/library/about-me": dynamic(() => import("@/features/library/about-screen")),
  "/shop": dynamic(() => import("@/features/shop/shop-screen")),
};
type TabPath = keyof typeof screens;
const isTabPath = (path: string): path is TabPath =>
  Object.hasOwn(screens, path);

export default function TabScreens({
  path,
  children,
  initialHomeDate,
}: {
  path: string;
  children: ReactNode;
  initialHomeDate: string;
}) {
  const [visited, setVisited] = useState<TabPath[]>(() =>
    isTabPath(path) ? [path] : [],
  );
  if (isTabPath(path) && !visited.includes(path))
    setVisited([...visited, path]);
  const panels = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Retained media must not keep playing after its section becomes hidden.
    panels.current
      ?.querySelectorAll<HTMLMediaElement>("[hidden] video, [hidden] audio")
      .forEach((media) => media.pause());
  }, [path]);
  return (
    <div ref={panels} className={styles.screens}>
      {visited.map((tab) => {
        const Screen = screens[tab];
        const active = path === tab;
        return (
          <ScreenActivity.Provider value={active} key={tab}>
            <div
              className={styles.screen}
              hidden={!active}
              inert={!active}
              data-tab-screen={tab}
            >
              <ScreenErrorBoundary>
                <Suspense fallback={<TabLoading path={tab} />}>
                  <Screen initialDate={initialHomeDate} />
                </Suspense>
              </ScreenErrorBoundary>
            </div>
          </ScreenActivity.Provider>
        );
      })}
      {!isTabPath(path) && children}
    </div>
  );
}
