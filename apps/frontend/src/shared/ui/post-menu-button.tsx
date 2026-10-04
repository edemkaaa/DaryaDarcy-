"use client";
import classes from "./post-menu-button.module.scss";
import { Action } from "@/shared/ui/elements";
import { MaterialIcons } from "./icons";
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
