"use client";
import { useEffect } from "react";

const entryIndex = "__darcyEntryIndex";

export function hasAppHistory() {
  return (
    typeof window !== "undefined" && window.history.state?.[entryIndex] > 0
  );
}

/** Mark only entries created in this app, preserving Next's history state.
 * history.length also counts external pages and the initial blank tab.
 */
export function NavigationHistory() {
  useEffect(() => {
    const history = window.history;
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    const index = () => history.state?.[entryIndex] ?? 0;
    replaceState.call(history, { ...history.state, [entryIndex]: index() }, "");
    const push: History["pushState"] = function (state, title, url) {
      pushState.call(
        history,
        { ...state, [entryIndex]: index() + 1 },
        title,
        url,
      );
    };
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
