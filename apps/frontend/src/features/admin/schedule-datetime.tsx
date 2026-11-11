"use client";
/** Выбор отложенного времени преобразует локальные поля даты в значение редактора и показывает состояние планирования. */
import classes from "./schedule-datetime.module.scss";
import { Action, Typography } from "@/shared/ui/elements";
import { createElement, useState } from "react";
import { BROWN } from "./schedule-datetime.content";
function pad(value: number) {
  // Дополняет компоненты локальной даты до формата datetime-local.

  return String(value).padStart(2, "0");
}
export function toDatetimeLocalValue(date: Date) {
  // Использует локальные часы пользователя, избегая сдвига даты через UTC ISO-строку.

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function atHour(base: Date, hour: number) {
  // Создаёт копию даты и задаёт час пресета, не меняя исходную дату формы.

  const next = new Date(base);
  next.setHours(hour, 0, 0, 0);
  return next;
}
interface ScheduleDatetimeProps {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Allow selecting dates in the past (for archive backdating). */
  allowPast?: boolean;
}
export function ScheduleDatetime({
  value,
  onChange,
  allowPast = false,
}: ScheduleDatetimeProps) {
  // Отделяет планирование будущего от архивной даты публикации, для которой прошлое разрешено явно.

  const [defaultDate] = useState(() =>
    atHour(new Date(Date.now() + (allowPast ? 0 : 24 * 60 * 60 * 1000)), 10),
  );
  const selected = value || defaultDate;
  const setPreset = (daysAhead: number) => {
    // Считает календарные дни в локальной зоне и выбирает 10:00, а не фиксированную длительность в миллисекундах.

    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    onChange(atHour(date, 10));
  };
  return (
    <div className="ui-stack ">
      {createElement("input", {
        type: "datetime-local",
        value: toDatetimeLocalValue(selected),
        ...(allowPast ? {} : { min: toDatetimeLocalValue(new Date()) }),
        onChange: (event: {
          target?: {
            value?: string;
          };
        }) => {
          // Игнорирует пустую и некорректную дату native поля до передачи в форму.

          const next = event?.target?.value;
          if (!next) return;
          const parsed = new Date(next);
          if (!Number.isNaN(parsed.getTime())) onChange(parsed);
        },
        style: {
          color: BROWN,
        },
        className: classes.dateInput,
      })}
      {!allowPast ? (
        <div
          className={["ui-stack ", classes.presets].filter(Boolean).join(" ")}
        >
          <Action onClick={() => setPreset(1)} className={classes.preset}>
            <Typography className={classes.presetText}>Завтра 10:00</Typography>
          </Action>
          <Action onClick={() => setPreset(7)} className={classes.preset}>
            <Typography className={classes.presetText}>Через неделю</Typography>
          </Action>
          <Action onClick={() => setPreset(30)} className={classes.preset}>
            <Typography className={classes.presetText}>Через месяц</Typography>
          </Action>
        </div>
      ) : null}
    </div>
  );
}
