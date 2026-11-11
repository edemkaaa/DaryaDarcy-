"use client";
/** Диалоги координируют фокус, стек и недоступность фоновых элементов; скрытый сохранённый экран не должен владеть открытым окном. */
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useScreenActive } from "@/shared/navigation/screen-activity";
const dialogStack: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
// Верхний диалог владеет фокусом; исходный inert возвращаем только после закрытия всего стека.
function syncDialogBackground() {
  const top = dialogStack.at(-1);
  if (!top) {
    for (const [element, inert] of originalInert) element.inert = inert;
    originalInert.clear();
    return;
  }
  for (const element of document.body.children) {
    if (!(element instanceof HTMLElement)) continue;
    if (!originalInert.has(element)) originalInert.set(element, element.inert);
    element.inert = element !== top;
  }
}
type DialogProps = {
  label: string;
  open?: boolean;
  onClose?: () => void;
  motion?: "fade" | "slide" | "none";
  className?: string;
  children: ReactNode;
};
export function Dialog({
  label,
  open,
  onClose,
  motion = "none",
  className = "",
  children,
}: DialogProps) {
  const active = useScreenActive();
  const visible = open && active;
  const node = useRef<HTMLDivElement | null>(null),
    close = useRef(onClose);
  const trigger = useRef<HTMLElement | null>(null);
  // Capture before a newly mounted input can autofocus inside the portal.
  if (!visible) trigger.current = null;
  else if (!trigger.current && typeof document !== "undefined")
    trigger.current = document.activeElement as HTMLElement | null;
  close.current = onClose;
  useEffect(() => {
    if (!active && open) close.current?.();
  }, [active, open]);
  useEffect(() => {
    const current = node.current;
    if (!visible || !current) return;
    // Запоминаем источник открытия до autofocus портала, чтобы вернуть фокус в правильное место.
    const previous = trigger.current;
    dialogStack.push(current);
    syncDialogBackground();
    const observer = new MutationObserver(syncDialogBackground);
    observer.observe(document.body, { childList: true });
    const focusables = () =>
      [
        ...(node.current?.querySelectorAll<HTMLElement>(
          "button,input,textarea,select,a[href],[tabindex]",
        ) || []),
      ].filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.matches(':disabled,[aria-disabled="true"]') &&
          !el.closest("[inert]") &&
          el.getClientRects().length > 0,
      );
    const first = focusables()[0];
    (first || node.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (dialogStack.at(-1) !== current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close.current?.();
      }
      if (e.key === "Tab") {
        const list = focusables(),
          first = list[0],
          last = list[list.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          !current.contains(document.activeElement) ||
          document.activeElement === current
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Программный перенос фокуса за пределы верхнего окна тоже возвращаем внутрь, не только Tab.
    const containFocus = (event: FocusEvent) => {
      if (
        dialogStack.at(-1) === current &&
        event.target instanceof Node &&
        !current.contains(event.target)
      )
        (focusables()[0] || current).focus();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", containFocus);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", containFocus);
      const index = dialogStack.indexOf(current);
      const wasTop = index === dialogStack.length - 1;
      if (index !== -1) dialogStack.splice(index, 1);
      syncDialogBackground();
      if (wasTop && previous?.isConnected && !previous.closest("[inert]"))
        previous.focus();
    };
  }, [visible]);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`ui-dialog ui-dialog-${motion} ${className}`}
      role="dialog"
      aria-label={label}
      aria-modal="true"
      tabIndex={-1}
      ref={node}
    >
      {children}
    </div>,
    document.body,
  );
}
