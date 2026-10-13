"use client";
import { Action } from "@/shared/ui/action";
import { MaterialIcons } from "@/shared/ui/icons";
import classes from "./photo-navigation.module.scss";

export function PhotoNavigation({
  count,
  index,
  onNavigate,
}: {
  count: number;
  index: number;
  onNavigate: (index: number) => void;
}) {
  if (count < 2) return null;
  return (
    <>
      <Action
        aria-label="Предыдущее фото"
        disabled={index === 0}
        onClick={() => onNavigate(index - 1)}
        className={`${classes.button} ${classes.previous}`}
      >
        <MaterialIcons name="chevron-left" size={28} color="#fff" />
      </Action>
      <Action
        aria-label="Следующее фото"
        disabled={index === count - 1}
        onClick={() => onNavigate(index + 1)}
        className={`${classes.button} ${classes.next}`}
      >
        <MaterialIcons name="chevron-right" size={28} color="#fff" />
      </Action>
    </>
  );
}
