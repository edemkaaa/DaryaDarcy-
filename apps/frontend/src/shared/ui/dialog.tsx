"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
const dialogStack: symbol[] = [];
type DialogProps = {
  open?: boolean;
  onClose?: () => void;
  motion?: "fade" | "slide" | "none";
  children: ReactNode;
};
export function Dialog({
  open,
  onClose,
  motion = "none",
  children,
}: DialogProps) {
  const node = useRef<HTMLDivElement | null>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [
        ...(node.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ) || []),
      ].filter((el) => el.getClientRects().length > 0);
    const first = focusables()[0];
    (first || node.current)?.focus();
    const key = (e: KeyboardEvent) => {
      if (dialogStack.at(-1) !== token) return;
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
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      dialogStack.splice(dialogStack.indexOf(token), 1);
      previous?.focus();
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`ui-dialog ui-dialog-${motion}`}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      ref={node}
    >
      {children}
    </div>,
    document.body,
  );
}
