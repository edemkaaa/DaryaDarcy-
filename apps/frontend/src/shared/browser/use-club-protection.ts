"use client";
/** Ограничения копирования принадлежат активному экрану; они дополняют интерфейс, но не заменяют серверную проверку доступа. */
import { useEffect } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";

const owners = new Set<symbol>();
const events = ["copy", "cut", "contextmenu", "dragstart"] as const;
/** Не мешаем вводу и выделению в редактируемых контролах; остальные события копирования/drag останавливаем как UI-ограничение. */
function block(event: Event) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest('input, textarea, [contenteditable="true"]')
  )
    return;
  event.preventDefault();
}
/** Один набор document-level правил ставится при первом владельце защищённого активного экрана. */
function protect() {
  document.getElementById("root")?.classList.add("club-protected");
  document.body.classList.add("club-protected");
  for (const event of events) document.addEventListener(event, block, true);
}
/** Последний владелец снимает общие CSS-классы и обработчики, чтобы ограничения не оставались в публичных разделах. */
function release() {
  document.getElementById("root")?.classList.remove("club-protected");
  document.body.classList.remove("club-protected");
  for (const event of events) document.removeEventListener(event, block, true);
}

/** Счётчик владельцев учитывает параллельные/сохранённые экраны; cleanup одной страницы не снимает ещё нужную защиту другой. Скрытая сохранённая вкладка не владеет документной защитой. */
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
