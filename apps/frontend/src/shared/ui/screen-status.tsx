"use client";
/** Контейнер состояния сохраняет общую структуру страницы для ожидания, отказа доступа и ошибки. */
import type { ReactNode } from "react";
import { ScreenContainer } from "./screen-container";
import { ScrollArea } from "./scroll-area";
import classes from "./screen-status.module.scss";

/** Full-screen fallbacks have no banner to keep their content below the header. */
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
