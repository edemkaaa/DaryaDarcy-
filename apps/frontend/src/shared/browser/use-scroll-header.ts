"use client";
import { useCallback, useRef, type UIEvent } from "react";

/** Match the original home header without rendering React on every scroll tick. */
export function useScrollHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const previousY = useRef(0);
  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const y = Math.max(0, event.currentTarget.scrollTop);
    const diff = y - previousY.current;
    const header = headerRef.current;
    if (header) {
      const hidden = y === 0 || diff < -3 ? false : diff > 3 ? true : null;
      if (hidden !== null && header.dataset.hidden !== String(hidden)) {
        header.dataset.hidden = String(hidden);
        header.inert = hidden;
      }
    }
    previousY.current = y;
  }, []);
  return { headerRef, onScroll };
}
