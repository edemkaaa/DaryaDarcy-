"use client";
/** Контейнер состояния сохраняет общую структуру страницы для ожидания, отказа доступа и ошибки. */
import type { ReactNode } from "react";
import { ScreenContainer } from "./screen-container";
import { ScrollArea } from "./scroll-area";
import classes from "./screen-status.module.scss";

/** Размещаем полноэкранное состояние в прокручиваемой безопасной области без участия автоскрытия шапки. */
export function ScreenStatus({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <ScrollArea
        hideScrollbar
        data-scroll-header="ignore"
        className={classes.scroll}
        contentClassName={classes.content}
      >
        {children}
      </ScrollArea>
    </ScreenContainer>
  );
}
