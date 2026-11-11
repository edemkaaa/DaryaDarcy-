"use client";
/** Кнопка действий поста отделена от самой карточки, чтобы открытие меню не запускало переход в материал. */
import classes from "./post-menu-button.module.scss";
import { Action } from "@/shared/ui/elements";
import { MaterialIcons } from "./icons";
/** Отображаем отдельное действие карточки; Action с обработчиком остановит распространение клика на переход поста. */
export function PostMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Action
      onClick={onClick}
      aria-label="Действия с постом"
      className={({ pressed }) =>
        [classes.action, pressed ? classes.opacityState : classes.opacityState2]
          .filter(Boolean)
          .join(" ")
      }
    >
      <MaterialIcons name="more-vert" size={20} color="#7A6B5E" />
    </Action>
  );
}
