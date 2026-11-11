"use client";
/** Ограничения копирования принадлежат активному экрану; они дополняют интерфейс, но не заменяют серверную проверку доступа. */
import { useEffect } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";

const owners = new Set<symbol>();
const events = ["copy", "cut", "contextmenu", "dragstart"] as const;
function block(event: Event) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest('input, textarea, [contenteditable="true"]')
  )
    return;
  event.preventDefault();
}
function protect() {
  document.getElementById("root")?.classList.add("club-protected");
  document.body.classList.add("club-protected");
  for (const event of events) document.addEventListener(event, block, true);
}
function release() {
  document.getElementById("root")?.classList.remove("club-protected");
  document.body.classList.remove("club-protected");
  for (const event of events) document.removeEventListener(event, block, true);
}

/** Retained hidden screens cannot own document-wide copy protection. */
export function useClubContentProtection(enabled: boolean) {
  const active = useScreenActive();
  useEffect(() => {
    if (!enabled || !active) return;
    const owner = Symbol();
    if (!owners.size) protect();
    owners.add(owner);
    return () => {
      owners.delete(owner);
      if (!owners.size) release();
    };
  }, [enabled, active]);
}
